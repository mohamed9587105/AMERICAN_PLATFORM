@echo off
chcp 65001 > nul
echo Cleaning Next.js cache...
if exist .next rmdir /s /q .next
echo Starting Next.js with Webpack...
call npm.cmd run dev
pause
