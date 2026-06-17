#!/bin/bash
set -e

DOMAIN="${1:-musicapp.example.com}"

echo "=== Setting up Nginx for $DOMAIN ==="

# Copy nginx config
cp deploy/nginx.conf /etc/nginx/sites-available/musicapp
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/musicapp

# Enable site
ln -sf /etc/nginx/sites-available/musicapp /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Firewall
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable

# Test and reload
nginx -t
systemctl reload nginx

# Get HTTPS certificate
echo "=== Getting Let's Encrypt certificate ==="
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" --redirect

echo "=== Done! HTTPS is active ==="
