# Instala el Museo Interactivo WorldBrain en una computadora con Windows 10 u 11.
# No necesita permisos de administrador. Crea:
#   - un acceso directo en el Escritorio y en el menu Inicio,
#   - (con -AlEncender) otro en Inicio automatico, para que el museo se abra solo
#     al prender la computadora.
# El museo corre en Google Chrome o Microsoft Edge, en una ventana propia a
# pantalla completa, con su propio perfil (no toca el navegador normal).
# Se actualiza solo desde internet y funciona sin internet con la ultima version.
#
# Uso (PowerShell):
#   irm https://danielaguilarj.github.io/museo-interactivo/instalar/windows.ps1 | iex
# o con el archivo descargado:
#   powershell -ExecutionPolicy Bypass -File windows.ps1
# Para que NO se abra solo al prender la computadora: $env:MUSEO_SIN_INICIO = '1' antes de correrlo.

$AlEncender = -not $env:MUSEO_SIN_INICIO
$Direccion = if ($env:MUSEO_DIRECCION) { $env:MUSEO_DIRECCION } else { 'https://danielaguilarj.github.io/museo-interactivo/' }

$ErrorActionPreference = 'Stop'
Write-Host ''
Write-Host '  Museo Interactivo WorldBrain - instalacion' -ForegroundColor Yellow
Write-Host ''

$candidatos = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$navegador = $candidatos | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $navegador) {
  Write-Host 'No encontre Google Chrome ni Microsoft Edge. Instala Chrome desde google.com/chrome y vuelve a correr esto.' -ForegroundColor Red
  return
}
Write-Host "Navegador: $navegador"

$perfil = Join-Path $env:LocalAppData 'MuseoWorldBrain'
New-Item -ItemType Directory -Force -Path $perfil | Out-Null
$opciones = @(
  "--user-data-dir=`"$perfil`"",
  "--app=$Direccion",
  '--start-fullscreen',
  '--autoplay-policy=no-user-gesture-required',
  '--no-first-run', '--no-default-browser-check',
  '--disable-translate', '--disable-features=Translate',
  '--disable-session-crashed-bubble', '--disable-pinch',
  '--overscroll-history-navigation=0'
) -join ' '

$shell = New-Object -ComObject WScript.Shell
function Crear-Atajo([string]$ruta) {
  $a = $shell.CreateShortcut($ruta)
  $a.TargetPath = $navegador
  $a.Arguments = $opciones
  $a.WorkingDirectory = Split-Path $navegador
  $a.Description = 'Museo Interactivo WorldBrain'
  $a.Save()
  Write-Host "Acceso directo: $ruta"
}
Crear-Atajo (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Museo WorldBrain.lnk')
Crear-Atajo (Join-Path ([Environment]::GetFolderPath('Programs')) 'Museo WorldBrain.lnk')
if ($AlEncender) { Crear-Atajo (Join-Path ([Environment]::GetFolderPath('Startup')) 'Museo WorldBrain.lnk') }

# Que la pantalla y la computadora no se apaguen solas con el cargador conectado
try {
  powercfg /change monitor-timeout-ac 0 | Out-Null
  powercfg /change standby-timeout-ac 0 | Out-Null
  Write-Host 'Pantalla: no se apagara sola mientras este conectada a la corriente.'
} catch { Write-Host 'No pude cambiar el ahorro de energia (no importa).' }

Write-Host ''
Write-Host 'Listo. Abriendo el museo...' -ForegroundColor Green
Write-Host 'La primera vez: permite la camara cuando el navegador lo pregunte, pulsa la tecla A'
Write-Host 'y sigue los pasos de Ajustes (conectar el control de la camara, encuadrar y calibrar).'
Start-Process -FilePath $navegador -ArgumentList $opciones
