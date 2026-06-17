#!/bin/bash
set -e

DOMAIN="${1:-musicapp.example.com}"

echo "=== 1. System packages ==="
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx curl git

echo "=== 2. Install Node.js 22 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
corepack enable

echo "=== 3. Install Python deps ==="
pip3 install ytmusicapi yt-dlp --break-system-packages

echo "=== 4. Install PM2 ==="
npm install -g pm2

echo "=== 5. Create deploy user ==="
id -u musicapp &>/dev/null || useradd -m -s /bin/bash musicapp

echo "=== 6. Create app directory ==="
mkdir -p /home/musicapp/app
chown musicapp:musicapp /home/musicapp/app

echo "=== 7. Generate initial invite code ==="
cat > /home/musicapp/app/invite_codes.json <<'EOF'
[]
EOF
chown musicapp:musicapp /home/musicapp/app/invite_codes.json

echo "=== 8. Done ==="
echo "Next steps:"
echo "  1. Copy your project to /home/musicapp/app/"
echo "  2. Run: curl -fsSL https://deb.nodesource.com/setup_22.x | bash -"
echo "  3. cd /home/musicapp/app && npm install"
echo "  4. Create .env file (see deploy/env.example)"
echo "  5. Run: pm2 start deploy/ecosystem.config.js"
echo "  6. Run: bash deploy/setup-nginx.sh $DOMAIN"
echo ""
echo "Default invite code will be printed on first app start."
