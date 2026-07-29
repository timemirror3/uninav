#!/usr/bin/env bash
#
# One-shot: create the Turnstile widget, wire both keys, build, deploy.
#
# Requires CLOUDFLARE_API_TOKEN with:
#   Account · Turnstile      · Edit   (create the widget)
#   Account · Workers Scripts · Edit  (set the secret + deploy)
#
#   export CLOUDFLARE_API_TOKEN=...
#   ./scripts/setup-turnstile.sh
#
# Deliberately does NOT deploy Cloudflare's managed siteverify Worker. This app
# already verifies server-side in src/lib/turnstile.ts on every submission, and
# it fails closed. A second verification hop would be redundant infrastructure.
set -euo pipefail

SKILL="${HOME}/.claude/skills/turnstile-spin/scripts"
DOMAIN="universitynavigator.org"
WIDGET_NAME="University Navigator (Spin)"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN is not set." >&2
  echo "Create one at https://dash.cloudflare.com/profile/api-tokens (Custom token)" >&2
  echo "with Account.Turnstile:Edit and Account.Workers Scripts:Edit, then:" >&2
  echo "  export CLOUDFLARE_API_TOKEN=..." >&2
  exit 1
fi

echo "→ 1/5  Checking token scope and account…"
PROBE="$("$SKILL/auth-probe.sh")"
STATUS="$(printf '%s' "$PROBE" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("status",""))')"
if [ "$STATUS" != "ok" ]; then
  echo "$PROBE" >&2
  echo "Auth not usable (status: $STATUS). Fix the token/account and re-run." >&2
  exit 1
fi
ACCOUNT_ID="$(printf '%s' "$PROBE" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("account_id") or d["accounts"][0]["id"])')"
echo "   account: $ACCOUNT_ID"

echo "→ 2/5  Creating Turnstile widget for $DOMAIN…"
CREATED="$("$SKILL/widget-create.sh" \
  --account-id "$ACCOUNT_ID" \
  --name "$WIDGET_NAME" \
  --domains "$DOMAIN,www.$DOMAIN,localhost,127.0.0.1" \
  --mode managed)"
CSTATUS="$(printf '%s' "$CREATED" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("status",""))')"
if [ "$CSTATUS" != "ok" ]; then
  echo "$CREATED" >&2
  exit 1
fi
SITEKEY="$(printf '%s' "$CREATED" | python3 -c 'import json,sys;print(json.load(sys.stdin)["sitekey"])')"
SECRET="$(printf '%s' "$CREATED" | python3 -c 'import json,sys;print(json.load(sys.stdin)["secret"])')"
echo "   sitekey: $SITEKEY"

# The SITE key is public — it ships in the page source by design, so it belongs
# in the committed .env. The SECRET key is never written to disk.
echo "→ 3/5  Writing site key into .env…"
python3 - "$SITEKEY" <<'PY'
import pathlib, re, sys
key = sys.argv[1]
p = pathlib.Path('.env')
s = p.read_text()
s = re.sub(r'PUBLIC_TURNSTILE_SITE_KEY="[^"]*"', f'PUBLIC_TURNSTILE_SITE_KEY="{key}"', s)
p.write_text(s)
print("   .env updated")
PY

echo "→ 4/5  Uploading secret to the Worker…"
printf '%s' "$SECRET" | npx wrangler secret put TURNSTILE_SECRET_KEY

echo "→ 5/5  Building and deploying…"
npm run deploy

echo
echo "Done. Verify:"
echo "  curl -s https://$DOMAIN/contact/ | grep -o '\"turnstileSiteKey\":\\[0,\"[^\"]*\"\\]'"
echo "  # expect the sitekey above, not an empty string"
