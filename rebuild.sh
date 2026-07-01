#!/bin/bash
LOG=/tmp/rebuild.log
exec > $LOG 2>&1

echo "=== Rebuilding tenant ($(date)) ==="
cd /var/www/neurecore-tenant
npm run build
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then cp -r public .next/standalone/public; fi
pm2 restart neurecore-tenant
echo "=== TENANT_DONE ==="

echo ""
echo "=== Rebuilding admin ($(date)) ==="
cd /var/www/neurecore-admin
npm run build
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then cp -r public .next/standalone/public; fi
pm2 restart neurecore-admin
echo "=== ADMIN_DONE ==="

echo ""
echo "=== ALL_DONE $(date) ==="
