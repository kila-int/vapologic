# Dopuna: popravlja unose u lokacije-podaci.json kojima reverse geocoding nije nasao ulicu
# (tacka je pala u polje/park, pa je kao adresa ostao samo grad).
#
# Za svaki takav unos probamo nekoliko malih pomeraja oko originalne tacke dok ne
# naletimo na pravu ulicu; koordinata se pomeri najvise ~600 m, sto ne kvari raspored.
#
# Pokretanje: powershell -ExecutionPolicy Bypass -File tools/dopuni-bez-ulice.ps1

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$KEY = 'xCboGTDaRsqFuVgneleh'
$inv = [System.Globalization.CultureInfo]::InvariantCulture

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

function Get-Street($lat, $lng) {
  $la = ([double]$lat).ToString($inv); $ln = ([double]$lng).ToString($inv)
  try {
    $j = Invoke-RestMethod -Uri "https://api.maptiler.com/geocoding/$ln,$la.json?key=$KEY&language=sr" -UseBasicParsing
    $f = $j.features | Where-Object { $_.place_type -contains 'address' -or $_.place_type -contains 'street' } | Select-Object -First 1
    if ($f) {
      $street = (ToLat $f.text).Trim()
      $num = if ($f.address) { [string]$f.address } else { '' }
      if ($street) { return @{ addr = $(if ($num) { "$street $num" } else { $street }); lat = $lat; lng = $lng } }
    }
  } catch { Start-Sleep -Milliseconds 400 }
  return $null
}

$data = Get-Content 'lokacije-podaci.json' -Raw -Encoding UTF8 | ConvertFrom-Json
# pomeraji u stepenima: ~0.004 lat je oko 450 m
$offsets = @(@(0.003,0),@(-0.003,0),@(0,0.004),@(0,-0.004),@(0.004,0.005),@(-0.004,-0.005),@(0.005,-0.004),@(-0.005,0.004))

$fixed = 0; $stillMissing = 0
for ($i = 0; $i -lt $data.Count; $i++) {
  $e = $data[$i]
  if ($e.addr -ne $e.city) { continue }        # ova ima ulicu, preskoci

  $hit = $null
  foreach ($o in $offsets) {
    $hit = Get-Street ($e.lat + $o[0]) ($e.lng + $o[1])
    Start-Sleep -Milliseconds 120
    if ($hit) { break }
  }
  if ($hit) {
    $e.addr = "$($hit.addr), $($e.city)"
    $e.lat = [Math]::Round([double]$hit.lat, 6)
    $e.lng = [Math]::Round([double]$hit.lng, 6)
    $fixed++
    Write-Host "  popravljeno: $($e.addr)"
  } else {
    $stillMissing++
    Write-Host "  BEZ ULICE i dalje: $($e.city) $($e.lat),$($e.lng)"
  }
}

$json = $data | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path (Get-Location) 'lokacije-podaci.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ""
Write-Host "Popravljeno: $fixed  ·  i dalje bez ulice: $stillMissing"
