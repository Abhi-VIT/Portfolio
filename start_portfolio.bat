@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Creating the project environment...
  py -3.13 -m venv .venv
)

".venv\Scripts\python.exe" -c "import django, dateutil" 2>nul
if errorlevel 1 (
  echo Installing project requirements...
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
)

echo Preparing the portfolio...
".venv\Scripts\python.exe" manage.py migrate
if errorlevel 1 exit /b 1

echo.
echo Portfolio ready at http://127.0.0.1:8000/
echo Press Ctrl+C to stop the server.
echo.
".venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8000
