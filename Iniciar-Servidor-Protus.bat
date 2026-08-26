@echo off
setlocal
title Servidor Protus - Controle de Estoque
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao foi encontrado neste computador.
  echo  Instale o Node.js LTS em https://nodejs.org e rode este arquivo novamente.
  echo.
  pause
  exit /b 1
)

if "%PORT%"=="" set PORT=4040
echo Iniciando o servidor Protus na porta %PORT% ...
start "" http://localhost:%PORT%
node server\server.js
echo.
echo Servidor encerrado.
pause
