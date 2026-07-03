#!/bin/bash
LOG=/tmp/rebuild.log
exec > $LOG 2>&1

echo "=== Rebuilding tenant ($(date)) ==="
cd /opt/neurecore/frontend-tenant
npm run build
pm2 restart neurecore-tenant
echo "=== TENANT_DONE ==="

echo ""
echo "=== Rebuilding admin ($(date)) ==="
cd /opt/neurecore/frontend-admin
npm run build
pm2 restart neurecore-admin
echo "=== ADMIN_DONE ==="

echo ""
echo "=== ALL_DONE $(date) ==="
