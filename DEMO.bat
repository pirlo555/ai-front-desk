@echo off
title Demo - Recepcionista IA
cd /d "%~dp0"

echo.
echo  ====================================================
echo    PREPARANDO TU DEMO
echo    No cierres esta ventana mientras la ensenas.
echo  ====================================================
echo.

rem Cierra cualquier demo anterior que se haya quedado abierta.
taskkill /F /IM cloudflared.exe >nul 2>&1

echo  [1/2] Encendiendo el asistente...
start "Asistente IA" /min cmd /c "node src\server.js"
timeout /t 6 /nobreak >nul

echo  [2/2] Abriendo la puerta a internet...
if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" (
  set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
) else (
  set "CF=%ProgramFiles%\cloudflared\cloudflared.exe"
)
if exist "%TEMP%\nv-tunnel.log" del "%TEMP%\nv-tunnel.log"
start "Tunel" /min cmd /c ""%CF%" tunnel --url http://localhost:3000 --no-autoupdate > "%TEMP%\nv-tunnel.log" 2>&1"

echo.
echo  Esperando la direccion de internet (unos 20 segundos)...
set "URL="
for /l %%i in (1,1,30) do (
  if not defined URL (
    timeout /t 2 /nobreak >nul
    for /f "tokens=*" %%a in ('findstr /r /c:"https://[a-z0-9-]*\.trycloudflare\.com" "%TEMP%\nv-tunnel.log" 2^>nul') do (
      for %%b in (%%a) do (
        echo %%b | findstr /c:"trycloudflare.com" >nul && if not defined URL set "URL=%%b"
      )
    )
  )
)

cls
echo.
if not defined URL (
  echo  No se pudo abrir la puerta a internet.
  echo  Prueba a cerrar esta ventana y abrirla otra vez.
  echo  Si sigue fallando, tu demo local aun funciona en:
  echo     http://localhost:3000/demo/rapido-air
  echo.
  pause
  exit /b 1
)

echo  ====================================================
echo    TU DEMO ESTA LISTA
echo  ====================================================
echo.
echo   ENSENA ESTO AL CLIENTE (chat en su web):
echo.
echo     Fontanero / aire:   %URL%/demo/rapido-air
echo     Dentista:           %URL%/demo/brisa
echo     Abogado:            %URL%/demo/costa-legal
echo.
echo   PARA TI (no lo ensenes todavia):
echo.
echo     Panel de contactos: %URL%/dashboard
echo     Simular llamada:    %URL%/simulator
echo.
echo  ====================================================
echo   Funciona desde cualquier movil u ordenador del mundo.
echo   Al cerrar esta ventana, la direccion deja de servir
echo   y la proxima vez sera distinta. Eso es normal.
echo  ====================================================
echo.

rem Deja la direccion en el portapapeles para pegarla facil.
echo %URL%/demo/rapido-air| clip
echo  (La direccion del fontanero ya esta copiada: pega con Ctrl+V)
echo.
echo  Pulsa una tecla cuando termines la demo para cerrar todo.
pause >nul

echo.
echo  Cerrando...
taskkill /F /IM cloudflared.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo  Listo. Puedes cerrar esta ventana.
timeout /t 3 /nobreak >nul
