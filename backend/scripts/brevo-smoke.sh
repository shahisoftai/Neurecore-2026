#!/usr/bin/env bash
# Smoke-test the Brevo integration end-to-end.
#
# Usage:
#   bash scripts/brevo-smoke.sh <base-url> <jwt-cookie-or-bearer> <recipient-email>
# Example:
#   bash scripts/brevo-smoke.sh http://localhost:3000/api/v1 \
#     "Bearer eyJ..." you@yourdomain.com
#
# Requires: jq, curl. The backend must be running and the supplied auth must
# be valid for a real tenant.

set -euo pipefail

BASE_URL=${1:-http://localhost:3000/api/v1}
AUTH=${2:-}
TO=${3:-}

if [[ -z "$AUTH" || -z "$TO" ]]; then
  echo "Usage: $0 <base-url> <auth-header> <recipient-email>" >&2
  exit 1
fi

AUTH_HEADER=()
if [[ "$AUTH" == Bearer* ]]; then
  AUTH_HEADER=(-H "Authorization: $AUTH")
else
  AUTH_HEADER=(-H "Cookie: $AUTH")
fi

echo "→ 1. Validate Brevo key"
curl -fsS "${AUTH_HEADER[@]}" "$BASE_URL/integrations/brevo/validate" | tee /tmp/brevo-validate.json
echo

echo "→ 2. Check today's quota"
curl -fsS "${AUTH_HEADER[@]}" "$BASE_URL/integrations/usage/brevo" | tee /tmp/brevo-usage.json
echo

echo "→ 3. Send a test email to $TO"
curl -fsS "${AUTH_HEADER[@]}" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "{\"to\":\"$TO\",\"subject\":\"Brevo smoke test\",\"htmlContent\":\"<p>Delivered at $(date -u +%FT%TZ)</p>\"}" \
  "$BASE_URL/integrations/brevo/test-send" | tee /tmp/brevo-send.json
echo

echo "→ 4. Quota after send (should be +1)"
curl -fsS "${AUTH_HEADER[@]}" "$BASE_URL/integrations/usage/brevo"
echo

echo "✓ Smoke test complete."
