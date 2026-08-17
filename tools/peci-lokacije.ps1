# Korak 2 od 2: pretvara tools/tacke.json u lokacije-podaci.json
#
# Zasto: mock adrese su bile nasumicna kombinacija ulice iz liste i broja, pa je pin
# na mapi stajao na jednom mestu, a tekst ispod njega govorio o sasvim drugoj ulici.
# Ovde svaku tacku reverse-geocodiramo i uzimamo ulicu koja tamo STVARNO postoji.
#
# Pokretanje (iz korena projekta):
#   node tools/tacke.mjs
#   powershell -ExecutionPolicy Bypass -File tools/peci-lokacije.ps1
#
# Kosta ~255 geocoding zahteva JEDNOM. Sajt posle toga cita staticki JSON i ne trosi nista.
# Napomena: `limit` se NE salje - MapTiler na reverse vraca 400 ako limit nije uz types.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$KEY = 'xCboGTDaRsqFuVgneleh'
$inv = [System.Globalization.CultureInfo]::InvariantCulture

# cirilica -> latinica (isto preslikavanje kao na sajtu).
# MORA Dictionary sa Ordinal komparatorom: PowerShell hashtable ne razlikuje
# velika i mala slova, pa bi se 'А' i 'а' smatrali istim kljucem.
$CYR = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
$velika = 'АБВГДЂЕЖЗИЈКЛЉМНЊОПРСТЋУФХЦЧЏШ'
$velikaLat = @('A','B','V','G','D','Đ','E','Ž','Z','I','J','K','L','Lj','M','N','Nj','O','P','R','S','T','Ć','U','F','H','C','Č','Dž','Š')
$mala = 'абвгдђежзијклљмнњопрстћуфхцчџш'
$malaLat = @('a','b','v','g','d','đ','e','ž','z','i','j','k','l','lj','m','n','nj','o','p','r','s','t','ć','u','f','h','c','č','dž','š')
for ($n = 0; $n -lt $velika.Length; $n++) { $CYR[[string]$velika[$n]] = $velikaLat[$n] }
for ($n = 0; $n -lt $mala.Length; $n++)   { $CYR[[string]$mala[$n]]   = $malaLat[$n] }
function ToLat($s) {
  if (-not $s) { return '' }
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $k = [string]$ch
    if ($CYR.ContainsKey($k)) { [void]$sb.Append($CYR[$k]) } else { [void]$sb.Append($ch) }
  }
  return $sb.ToString()
}

$points = Get-Content 'tools/tacke.json' -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host "Ucitano $($points.Count) tacaka. Pocinjem reverse geocoding..."

$out = New-Object System.Collections.Generic.List[object]
$ok = 0; $miss = 0; $i = 0

foreach ($p in $points) {
  $i++
  $la = ([double]$p.lat).ToString($inv)
  $ln = ([double]$p.lng).ToString($inv)
  $url = "https://api.maptiler.com/geocoding/$ln,$la.json?key=$KEY&language=sr"

  $addr = $null
  for ($try = 1; $try -le 3 -and -not $addr; $try++) {
    try {
      $j = Invoke-RestMethod -Uri $url -UseBasicParsing
      # prvi rezultat tipa address/street je najspecificniji sto MapTiler ima za tu tacku
      $f = $j.features | Where-Object { $_.place_type -contains 'address' -or $_.place_type -contains 'street' } | Select-Object -First 1
      if ($f) {
        $street = (ToLat $f.text).Trim()
        $num = if ($f.address) { [string]$f.address } else { '' }
        if ($street) { $addr = if ($num) { "$street $num" } else { $street } }
      }
    } catch {
      Start-Sleep -Milliseconds 500   # rate limit / mrezni trzaj
    }
  }

  if ($addr) { $ok++ } else { $miss++ }
  $out.Add([ordered]@{
    typeKey = $p.typeKey
    city    = $p.city
    # ako reverse ne nadje ulicu (tacka pala u polje), ostaje samo grad -
    # bolje nego izmisljena ulica koja tamo ne postoji
    addr    = if ($addr) { "$addr, $($p.city)" } else { $p.city }
    lat     = $p.lat
    lng     = $p.lng
  })

  if ($i % 25 -eq 0) { Write-Host "  $i/$($points.Count) (sa ulicom $ok, bez $miss)" }
  Start-Sleep -Milliseconds 120        # ne udaraj API bez pauze
}

$json = $out | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path (Get-Location) 'lokacije-podaci.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ""
Write-Host "Gotovo: $($out.Count) lokacija -> lokacije-podaci.json"
Write-Host "Sa pravom ulicom: $ok  ·  bez ulice (ostao samo grad): $miss"
