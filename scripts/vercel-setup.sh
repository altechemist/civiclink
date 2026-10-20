#!/usr/bin/env bash
# One-time production setup on Vercel + GitHub (ADR-0006, docs/deploy.md).
#   scripts/vercel-setup.sh path/to/service-account.json
# Needs: `npx vercel@62.4.0 login` done, `gh auth login` done, apps/web/.env.production.local present.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="${1:?usage: scripts/vercel-setup.sh path/to/service-account.json}"
[ -f "$KEY" ] || { echo "Key file not found: $KEY"; exit 1; }
VERCEL="npx -y vercel@62.4.0"
ENV_FILE=apps/web/.env.production.local
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }

$VERCEL link --yes --project civiclink >/dev/null

set_env() { # name value [--sensitive|--no-sensitive]: set the Production value via stdin (never in argv)
  printf '%s' "$2" | $VERCEL env add "$1" production --force --yes "${3:---no-sensitive}" >/dev/null 2>&1 \
    || { echo "  failed to set $1"; exit 1; }
  echo "  set $1"
}

echo "Web configuration:"
while IFS='=' read -r name value; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  set_env "$name" "$value"
done < "$ENV_FILE"

echo "Server secrets:"
set_env FIREBASE_SERVICE_ACCOUNT "$(base64 -w0 "$KEY")" --sensitive
CRON_SECRET=$(openssl rand -hex 32)
set_env CRON_SECRET "$CRON_SECRET" --sensitive

echo "Deploying…"
URL=$($VERCEL deploy --prod --yes 2>/dev/null | tail -1)
APP_URL=$($VERCEL inspect "$URL" 2>&1 | grep -oE 'https://civiclink[a-z0-9-]*\.vercel\.app' | head -1 || true)
APP_URL=${APP_URL:-$URL}

echo "GitHub schedule:"
printf '%s' "$CRON_SECRET" | gh secret set CRON_SECRET
gh variable set APP_URL --body "$APP_URL"
echo "Done: $APP_URL"
echo "Next: add $(echo "$APP_URL" | sed 's#https://##') to Firebase Authentication → Settings → Authorized domains."
