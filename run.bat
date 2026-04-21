@echo off
REM Uruchamia aplikacje Drink Delivery przez docker compose.
REM Uzycie: dwuklik w Eksploratorze lub `run.bat` w terminalu.

title Drink Delivery - docker compose up

cd /d "%~dp0"
echo.
echo === Folder: %CD%
echo === Uruchamiam: docker compose up --build
echo.

docker compose up --build

echo.
echo === docker compose zakonczone. Nacisnij dowolny klawisz, aby zamknac okno.
pause >nul
