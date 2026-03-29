@echo off
REM ============================================================
REM  Run this from inside your isdn\server\ folder
REM  It creates a correct .env file for WAMP
REM  Double-click or run: fix-env.bat
REM ============================================================

(
echo PORT=5000
echo DB_HOST=localhost
echo DB_PORT=3306
echo DB_USER=root
echo DB_PASSWORD=
echo DB_NAME=isdn_db
echo JWT_SECRET=isdn_super_secret_jwt_key_2024_do_not_share
echo JWT_REFRESH_SECRET=isdn_refresh_secret_jwt_key_2024_do_not_share
echo JWT_EXPIRES_IN=15m
echo JWT_REFRESH_EXPIRES_IN=7d
echo NODE_ENV=development
) > .env

echo .env file created in current directory!
echo.
echo Now run:  npm run dev
pause
