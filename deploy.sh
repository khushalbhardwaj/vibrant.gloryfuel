#!/bin/bash
# GloryFuel Deployment Script
# 1. Deploy Cloudflare Worker first (video proxy)
# 2. Deploy Vercel static frontend

echo "=== GloryFuel Deployment ==="
echo ""
echo "Step 1: Deploy Cloudflare Worker (video + API proxy)"
echo "  - Go to https://dash.cloudflare.com/ -> Workers & Pages"
echo "  - Create Worker -> paste worker.js -> Deploy"
echo "  - Copy your worker URL (e.g., https://gloryfuel-proxy.xxx.workers.dev)"
echo ""
read -p "Paste your Worker URL: " WORKER_URL
echo ""
echo "Step 2: Update frontend to use Worker URL"
echo "  - Edit index.html, batch.html, player.html"
echo "  - Change: const API = \"\" → const API = \"$WORKER_URL\""
echo ""
echo "Step 3: Deploy to Vercel"
echo "  npx vercel --prod"
echo "  or: npm i -g vercel && vercel --prod"
echo ""
echo "Done!"
