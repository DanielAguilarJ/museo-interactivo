@echo off
rem Doble clic para instalar el Museo Interactivo WorldBrain en Windows.
rem Usa el archivo windows.ps1 de esta misma carpeta, o lo baja de internet.
chcp 65001 >nul
if exist "%~dp0windows.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://danielaguilarj.github.io/museo-interactivo/instalar/windows.ps1 | iex"
)
echo.
pause
