#!/usr/bin/env bash
# Fails if the repository holds anything that must never be published: addresses, keys, tokens, calendar or account ids,
# or the real names of the people whose site this came from. Run before every push: bash tools/privacy-scan.sh
# Names are never written here (this file is public). Put them in tools/private-patterns.txt, which git ignores: one
# extended regex per line, # for comments (see tools/private-patterns.example.txt). Or point PRIVATE_PATTERNS at a file.
set -u
cd "$(dirname "$0")/.."
fail=0
check() { # label, extended regex
  local hits
  hits=$(git ls-files -co --exclude-standard -z | xargs -0 grep -nIE "$2" -- 2>/dev/null | grep -v '^tools/privacy-scan.sh:' \
    | grep -vE '@example\.(com|org|edu|test)|noreply@|@users\.noreply\.github\.com|@(media|keyframes|import|supports|font-face|layer|container|page|property|charset)' || true)
  if [ -n "$hits" ]; then echo "✗ $1"; echo "$hits" | head -20; fail=1; else echo "✓ $1"; fi
}
check "email addresses"            '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}'
check "school or mail domains"     'snu\.ac\.kr|gmail\.com|naver\.com'
check "service-account ids"        'iam\.gserviceaccount\.com|"private_key"|BEGIN (RSA |EC )?PRIVATE KEY'
check "Google Calendar ids"        'c_[0-9a-f]{20,}|@group\.calendar\.google\.com'
check "OAuth client ids"           '[0-9]{8,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com'
check "tokens and keys"            'AIza[0-9A-Za-z_-]{30,}|ghp_[0-9A-Za-z]{30,}|github_pat_|xox[bap]-|sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.'
check "password assignments"       '(SITE_PASSWORD|PASSWORD|SECRET|TOKEN)[[:space:]]*=[[:space:]]*[^[:space:]<{$"'"'"'#]'
check "Cloudflare account/D1 ids"  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
names="${PRIVATE_PATTERNS:-tools/private-patterns.txt}"
if [ -f "$names" ]; then
  pat=$(grep -vE '^[[:space:]]*(#|$)' "$names" | paste -sd'|' -)
  if [ -n "$pat" ]; then check "private names ($names)" "$pat"; else echo "• private names: $names is empty"; fi
else
  echo "• private names: skipped (no $names; copy tools/private-patterns.example.txt)"
fi
check "phone numbers"              '01[016789]-?[0-9]{3,4}-?[0-9]{4}'
exit $fail
