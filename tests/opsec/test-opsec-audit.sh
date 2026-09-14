#!/usr/bin/env bash
# Tests for scripts/opsec-audit.sh.
#
# Builds throwaway fixture projects in a temp dir, runs the audit on each, and
# checks exit codes and findings. Secret-shaped strings and plaintext URLs are
# assembled at runtime so this file never trips the audit itself.
#
# Usage: tests/opsec/test-opsec-audit.sh

set -euo pipefail
export LC_ALL=C

HERE=$(CDPATH='' cd -P -- "$(dirname -- "$0")" && pwd -P)
AUDIT="$HERE/../../scripts/opsec-audit.sh"
[ -f "$AUDIT" ] || {
  printf 'audit script not found: %s\n' "$AUDIT" >&2
  exit 1
}

tmp=$(mktemp -d "${TMPDIR:-/tmp}/opsec-audit-test.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

pass=0
fail=0
OUT=""
CODE=0

ok() {
  pass=$((pass + 1))
  printf 'ok    %s\n' "$1"
}

not_ok() {
  fail=$((fail + 1))
  printf 'FAIL  %s\n' "$1"
  printf '%s\n' "$OUT" | sed 's/^/      | /'
}

# audit <args...>: run the audit, keep combined output in OUT and status in CODE.
audit() {
  set +e
  OUT=$(bash "$AUDIT" "$@" 2>&1)
  CODE=$?
  set -e
}

expect_exit() { # <label> <code>
  if [ "$CODE" -eq "$2" ]; then ok "$1: exit $2"; else not_ok "$1: expected exit $2, got $CODE"; fi
}

expect_has() { # <label> <text>
  case "$OUT" in
    *"$2"*) ok "$1" ;;
    *) not_ok "$1: output lacks '$2'" ;;
  esac
}

expect_lacks() { # <label> <text> (text itself is never printed)
  case "$OUT" in
    *"$2"*) not_ok "$1" ;;
    *) ok "$1" ;;
  esac
}

rep() { # <string> <count>
  local out="" i=0
  while [ "$i" -lt "$2" ]; do
    out="$out$1"
    i=$((i + 1))
  done
  printf '%s' "$out"
}

H=http
NSEC="nsec""1$(rep qp 29)"
AWS_KEY="AKIA""$(rep Q7 8)"
AWS_DOC_KEY="AKIA""IOSFODNN7EXAMPLE"
API_KEY="sk-""proj-$(rep aB3 10)"
API_PLACEHOLDER="sk-""your-api-key-goes-here-000000"
PEM_HEAD="-----BEGIN ""RSA PRIVATE KEY-----"

# --- fixture 1: clean project (path contains a space) -----------------------
clean="$tmp/clean project"
mkdir -p "$clean/src" "$clean/dist" "$clean/node_modules/tracker" "$clean/.wrangler/tmp" "$clean/coverage" "$clean/.git"
cat >"$clean/index.html" <<'EOF'
<!doctype html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"></head>
<body><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"></svg>
<script type="module" src="/src/app.js"></script></body>
</html>
EOF
cat >"$clean/src/app.js" <<'EOF'
const RELAY = 'wss://relay.example.org';
localStorage.setItem('theme', 'dark');
console.log('ready');
fetch('http://localhost:8787/health');
fetch('http://127.0.0.1:8787/health');
EOF
printf '%s\n' "const MIRROR = '$H://abcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuv.onion/';" >>"$clean/src/app.js"
cat >"$clean/app.css" <<'EOF'
body { font-family: system-ui, sans-serif; }
.mask-image-gradient-horizontal-extended { mask-image: none; }
EOF
printf 'LLM_BASE_URL=\nLLM_API_KEY=%s\n' "$API_PLACEHOLDER" >"$clean/.env.example"
printf 'AWS docs sample key: %s\n' "$AWS_DOC_KEY" >"$clean/NOTES.md"
printf 'export const x = 1;\n' >"$clean/dist/app.js"
printf "gtag('config', 'G-SKIPPED');\n" >"$clean/node_modules/tracker/index.js"
printf "gtag('config', 'G-SKIPPED');\n" >"$clean/.wrangler/tmp/bundle.js"
printf "gtag('config', 'G-SKIPPED');\n" >"$clean/coverage/report.js"
printf '%s\n' "$NSEC" >"$clean/.git/leftover"

audit "$clean"
expect_exit "clean project" 0
expect_has "clean project: zero findings" "Summary: 0 HIGH, 0 MED, 0 LOW"
audit "$clean" --strict
expect_exit "clean project --strict" 0

# --- fixture 2: Google Analytics gtag ---------------------------------------
gtag_dir="$tmp/with-gtag"
mkdir -p "$gtag_dir"
cat >"$gtag_dir/index.html" <<'EOF'
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag('config', 'G-ABC123');
</script>
EOF

audit "$gtag_dir"
expect_exit "gtag project" 1
expect_has "gtag project: loader flagged HIGH" "HIGH  index.html:1  [analytics]"
expect_has "gtag project: gtag() call flagged" "index.html:5  [analytics]"
expect_has "gtag project: FAIL result" "Result: FAIL"

# --- fixture 3: nsec written to localStorage --------------------------------
nsec_dir="$tmp/nsec-storage"
mkdir -p "$nsec_dir/src"
printf '%s\n' \
  'export function rememberKey() {' \
  "  localStorage.setItem('nsec', '$NSEC');" \
  '}' >"$nsec_dir/src/keys.js"

audit "$nsec_dir"
expect_exit "nsec project" 1
expect_has "nsec project: storage rule" "HIGH  src/keys.js:2  [storage-secret]"
expect_has "nsec project: secret rule" "HIGH  src/keys.js:2  [secret:nostr-nsec]"
expect_lacks "nsec project: key value never echoed" "$NSEC"

# --- fixture 4: Google Fonts ------------------------------------------------
fonts_dir="$tmp/google-fonts"
mkdir -p "$fonts_dir"
cat >"$fonts_dir/style.css" <<'EOF'
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap');
body { font-family: 'Vazirmatn', system-ui, sans-serif; }
EOF

audit "$fonts_dir"
expect_exit "google fonts project (MED only)" 0
expect_has "google fonts project: font flagged MED" "MED   style.css:1  [cdn-font]"
expect_has "google fonts project: counts" "Summary: 0 HIGH, 1 MED, 0 LOW"
audit "$fonts_dir" --strict
expect_exit "google fonts project --strict" 1
audit --strict "$fonts_dir"
expect_exit "google fonts project, --strict first" 1

# --- fixture 5: every remaining rule ----------------------------------------
mixed="$tmp/mixed"
mkdir -p "$mixed/src" "$mixed/dist"
printf '<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>\n' >"$mixed/index.html"
printf '%s\n' \
  "const API = '$H://news-api.example-host.net/v1';" \
  "// docs: $H://docs.example-host.net/guide" \
  "const MIRROR = '$H://abcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuv.onion/';" \
  >"$mixed/src/net.ts"
printf '%s\n' "export const cfg = { aws: '$AWS_KEY', llm: '$API_KEY' };" >"$mixed/src/config.js"
printf "console.log('session token', token);\n" >"$mixed/src/debug.js"
printf '%s\nMIIBOgIBAAJBAK\n' "$PEM_HEAD" >"$mixed/id_rsa"
printf 'LLM_API_KEY=\n' >"$mixed/.env"
printf '{"version":3,"sources":["/Users/someone/app/src/net.ts"]}\n' >"$mixed/dist/app.js.map"
printf '{"dependencies":{"posthog-js":"^1.0.0"}}\n' >"$mixed/package.json"

audit "$mixed"
expect_exit "mixed project" 1
expect_has "mixed: CDN script HIGH" "HIGH  index.html:1  [cdn-code]"
expect_has "mixed: plaintext URL MED" "MED   src/net.ts:1  [http]"
expect_has "mixed: plaintext URL in comment LOW" "LOW   src/net.ts:2  [http]"
expect_lacks "mixed: .onion URL exempt" "src/net.ts:3"
expect_has "mixed: AWS key" "HIGH  src/config.js:1  [secret:aws]"
expect_has "mixed: sk- API key" "HIGH  src/config.js:1  [secret:api-key]"
expect_has "mixed: PEM private key" "HIGH  id_rsa:1  [secret:private-key]"
expect_has "mixed: token logged" "MED   src/debug.js:1  [console-secret]"
expect_has "mixed: real .env file" "HIGH  .env:1  [env-file]"
expect_has "mixed: shipped source map" "MED   dist/app.js.map:1  [sourcemap]"
expect_has "mixed: analytics dependency in package.json" "HIGH  package.json:1  [analytics]"
expect_lacks "mixed: AWS key never echoed" "$AWS_KEY"
expect_lacks "mixed: API key never echoed" "$API_KEY"

# --- fixture 6: allow markers -----------------------------------------------
allow_dir="$tmp/allow-markers"
mkdir -p "$allow_dir/src"
printf '%s\n' \
  "const specVector = '$NSEC'; // opsec-audit: allow NIP-19 spec test vector" \
  '// opsec-audit: allow public docs sample, not a real key' \
  "const docKey = '$AWS_KEY';" \
  '// opsec-audit: allow' \
  "const noReason = '$API_KEY';" \
  "const closerOnly = '$API_KEY'; /* opsec-audit: allow */" \
  >"$allow_dir/src/vectors.ts"

audit "$allow_dir"
expect_exit "allow markers: unsuppressed HIGH still fails" 1
expect_lacks "allow markers: same-line marker suppresses" "HIGH  src/vectors.ts:1"
expect_lacks "allow markers: line-above marker suppresses" "HIGH  src/vectors.ts:3"
expect_has "allow markers: suppression listed" "ALLOW src/vectors.ts:1  [secret:nostr-nsec]"
expect_has "allow markers: marker without reason does not suppress" "HIGH  src/vectors.ts:5  [secret:api-key]"
expect_has "allow markers: comment closer is not a reason" "HIGH  src/vectors.ts:6  [secret:api-key]"
expect_has "allow markers: suppressed count in summary" "(2 findings, 2 suppressed,"

allow_only="$tmp/allow-only"
mkdir -p "$allow_only"
printf '%s\n' '// opsec-audit: allow NIP-19 spec test vector' "export const vector = '$NSEC';" >"$allow_only/vector.ts"
audit "$allow_only" --strict
expect_exit "allow markers: only suppressed findings pass --strict" 0
expect_has "allow markers: counted even when passing" "Summary: 0 HIGH, 0 MED, 0 LOW (0 findings, 1 suppressed,"

# --- gitignored .env drops to LOW (needs git; temp repo, never committed) ---
if command -v git >/dev/null 2>&1; then
  ignored="$tmp/env-ignored"
  mkdir -p "$ignored"
  git -C "$ignored" init -q
  printf '.env\n' >"$ignored/.gitignore"
  printf 'LLM_API_KEY=\n' >"$ignored/.env"
  audit "$ignored"
  expect_exit "gitignored .env (LOW only)" 0
  expect_has "gitignored .env: flagged LOW" "LOW   .env:1  [env-file]"
else
  printf 'skip  gitignored .env (git not installed)\n'
fi

# --- fixture 7: bad usage ---------------------------------------------------
audit
expect_exit "usage: no arguments" 2
expect_has "usage: prints usage" "Usage:"
audit "$tmp/does-not-exist"
expect_exit "usage: missing path" 2
audit "$gtag_dir/index.html"
expect_exit "usage: file instead of directory" 2
audit ""
expect_exit "usage: empty string" 2
audit "$clean" --bogus
expect_exit "usage: unknown flag" 2
audit "$clean" "$gtag_dir"
expect_exit "usage: two directories" 2
audit --strict
expect_exit "usage: flag without directory" 2
audit --help
expect_exit "usage: --help" 0

# --- self checks ------------------------------------------------------------
self="$tmp/self"
mkdir -p "$self"
cp "$AUDIT" "$HERE/test-opsec-audit.sh" "$self/"
audit "$self" --strict
expect_exit "audit script and this test do not trip the audit" 0

for f in "$AUDIT" "$HERE/test-opsec-audit.sh"; do
  OUT=""
  if bash -n "$f"; then ok "bash -n ${f##*/}"; else not_ok "bash -n ${f##*/}"; fi
done

if command -v shellcheck >/dev/null 2>&1; then
  if OUT=$(shellcheck "$AUDIT" "$HERE/test-opsec-audit.sh" 2>&1); then
    ok "shellcheck"
  else
    not_ok "shellcheck"
  fi
else
  printf 'skip  shellcheck (not installed)\n'
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
