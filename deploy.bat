@echo off
REM GloryFuel Deployment Script (Windows)
echo === GloryFuel Deployment ===
echo.
echo Step 1: Deploy Cloudflare Worker (video + API proxy)
echo   - Go to https://dash.cloudflare.com/ ^> Workers ^& Pages
echo   - Create Worker -^> paste worker.js -^> Deploy
echo   - Copy your worker URL (e.g., https://gloryfuel-proxy.xxx.workers.dev)
echo.
set /p WORKER_URL="Paste your Worker URL: "
echo.
echo Step 2: Update frontend to use Worker URL
echo   Edit index.html, batch.html, player.html:
echo   Change: const API = "" ^-^> const API = "%WORKER_URL%"
echo.
echo Step 3: Deploy to Vercel
echo   npx vercel --prod
echo   or: npm i -g vercel ^&^& vercel --prod
echo.
echo Done!
pause
