#!/usr/bin/env bash
# opsec-audit.sh: tripwire for leaks that betray activist users. Flags
# telemetry SDKs, third-party CDN/font/tile requests, plaintext http://,
# likely secrets, real env files, key material in logs or web storage, and
# source maps in build output.
#
# Usage: scripts/opsec-audit.sh <dir> [--strict]
# Exit:  0 no HIGH findings (and no findings at all with --strict)
#        1 at least one HIGH finding, or any finding with --strict
#        2 usage error
#
# Runs on macOS (bash 3.2, BSD grep/find/xargs) and Linux (GNU tools).
# Matched text is never printed, so the report is safe to paste into CI logs.

set -euo pipefail
export LC_ALL=C

PROG=${0##*/}
TAB=$(printf '\t')

usage() {
  cat <<EOF
Usage: $PROG <dir> [--strict]

Scans <dir> for opsec leaks, skipping node_modules, .git, .wrangler, coverage.
Prints severity (HIGH/MED/LOW), file:line, rule, and a one-line fix hint.

To accept a known-safe match (a public spec test vector, say), put the marker
"opsec-audit: allow <reason>" on the same line or the line above. The reason
must contain a word of 3+ letters or digits. Suppressed findings are listed
as ALLOW and counted in the summary; they never affect the exit code.

  --strict     fail on any finding, not only HIGH
  -h, --help   show this help

Exit codes: 0 pass, 1 HIGH finding (any finding with --strict), 2 usage error.
EOF
}

usage_error() {
  printf '%s: %s\n\n' "$PROG" "$1" >&2
  usage >&2
  exit 2
}

strict=0
target=""
have_target=0
for arg in "$@"; do
  case "$arg" in
    --strict) strict=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*) usage_error "unknown option: $arg" ;;
    *)
      [ "$have_target" -eq 0 ] || usage_error "expected exactly one directory"
      target=$arg
      have_target=1
      ;;
  esac
done

[ "$have_target" -eq 1 ] || usage_error "missing <dir>"
[ -n "$target" ] || usage_error "<dir> is an empty string"
[ -e "$target" ] || usage_error "no such file or directory: $target"
[ -d "$target" ] || usage_error "not a directory: $target"
root=$(CDPATH='' cd -P -- "$target" 2>/dev/null && pwd -P) || usage_error "cannot open directory: $target"

work=$(mktemp -d "${TMPDIR:-/tmp}/opsec-audit.XXXXXX")
trap 'rm -rf "$work"' EXIT
findings="$work/findings"
: >"$findings"

shopt -s nocasematch

# --- rules -----------------------------------------------------------------

RE_ANALYTICS='google-analytics|googletagmanager|gtag\(|gtag/js|segment\.(com|io)|@segment/|mixpanel|posthog|@sentry/|sentry\.io|sentry-cdn|sentry\.init|hotjar|@amplitude/|amplitude\.com|amplitude-js|@datadog/browser-rum|datadoghq-browser-agent|dd_rum|connect\.facebook\.net|fbevents\.js|fbq\(|cloudflareinsights\.com|plausible\.io|@vercel/analytics'
RE_CDN='cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|code\.jquery\.com|ajax\.googleapis\.com|cdn\.skypack\.dev|esm\.sh/|kit\.fontawesome\.com|cdn\.tailwindcss\.com'
RE_FONT='fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net'
RE_TILES='tile\.openstreetmap\.org|api\.mapbox\.com|maps\.googleapis\.com|basemaps\.cartocdn\.com|tiles\.stadiamaps\.com|server\.arcgisonline\.com'
RE_CONSOLE='console\.(log|error|warn|info|debug|trace)[[:space:]]*\([^;]{0,160}(key|nsec|seed|password|passwd|token|mnemonic|secret)'
RE_STORAGE='(local|session)storage\.setitem[[:space:]]*\([^;]{0,160}(nsec|seed|mnemonic|privkey|priv_key|private_?key|secret_?key|xprv)'

RE_ALLOW='opsec-audit: allow[[:space:]]+[^[:space:]]*[A-Za-z0-9]{3,}'

H_ANALYTICS='Remove this analytics/telemetry SDK; it reports every visitor to a third party.'
H_CDN='Bundle it locally; a CDN logs every visitor IP and can change the code you run.'
H_FONT='Self-host the font or use system fonts; the font host logs every visitor IP and page.'
H_TILES='Self-host tiles (e.g. PMTiles on your origin); tile servers learn what area users view.'
H_HTTP='Use https://; plaintext is readable and rewritable on a watched network.'
H_SECRET='Revoke and rotate it, remove it from the tree and git history, load it at runtime.'
H_ENV='Real env file in the tree; ship only .env.example with placeholder names.'
H_ENV_IGNORED='Gitignored, but make sure deploy uploads and zips exclude it.'
H_CONSOLE='Do not log keys, tokens or seeds; logs persist on seized devices and in reporters.'
H_STORAGE='Key material in web storage; use a signer (NIP-07/NIP-46) or encrypt it (NIP-49).'
H_SOURCEMAP='Disable production source maps; they ship full source and developer paths.'

WEB_EXTS="html htm css scss sass less js mjs cjs jsx ts tsx mts cts vue svelte astro"
URL_EXTS="$WEB_EXTS json jsonc json5 toml yaml yml webmanifest py go rs rb php java kt swift sh"

PRUNE=('(' -type d '(' -name node_modules -o -name .git -o -name .wrangler -o -name coverage ')' ')' -prune)
LOCKFILES=(! -name package-lock.json ! -name npm-shrinkwrap.json ! -name yarn.lock ! -name pnpm-lock.yaml)

# --- helpers ---------------------------------------------------------------

# add <rank 1=HIGH 2=MED 3=LOW> <abs path> <line> <rule> <hint>
add() {
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "${2#"$root"/}" "$3" "$4" "$5" >>"$findings"
}

# find_ext <out> <ext...>: NUL-separated files with those extensions, no lockfiles.
find_ext() {
  local out=$1 names ext
  shift
  names=(-iname "*.$1")
  shift
  for ext in "$@"; do
    names+=(-o -iname "*.$ext")
  done
  find "$root" -mindepth 1 "${PRUNE[@]}" -o -type f '(' "${names[@]}" ')' "${LOCKFILES[@]}" -print0 >"$out"
}

# grep_hits <list> <grep args...>: writes "path NUL line:text" records to $work/hits.
grep_hits() {
  local list=$1
  shift
  : >"$work/hits"
  [ -s "$list" ] || return 0
  xargs -0 grep -I -s -n -H --null "$@" <"$list" >"$work/hits" || true
}

# scan <rank> <rule> <hint> <list> <grep args...>: one finding per matching line.
scan() {
  local rank=$1 rule=$2 hint=$3 list=$4 path rest
  shift 4
  grep_hits "$list" "$@"
  while IFS= read -r -d '' path && IFS= read -r rest; do
    add "$rank" "$path" "${rest%%:*}" "$rule" "$hint"
  done <"$work/hits"
}

# Plaintext http:// URLs. Loopback, .onion (Tor encrypts those), RFC 2606
# reserved names and XML namespace URIs are exempt. Commented lines are LOW.
# Only short grep -o matches reach bash: pattern removal on whole minified
# lines is quadratic and hangs on megabyte bundles.
scan_http() {
  local path rest host prev=""
  : >"$work/http.hits"
  : >"$work/http.lst"
  : >"$work/comments"
  grep_hits "$work/url.lst" -o -E -e 'http://[A-Za-z0-9][A-Za-z0-9.-]*'
  while IFS= read -r -d '' path && IFS= read -r rest; do
    host=${rest#*:http://}
    host=${host%.}
    case "$host" in
      localhost | *.localhost | 127.* | 0.0.0.0 | *.onion) continue ;;
      example.com | example.net | example.org | *.example.com | *.example.net | *.example.org) continue ;;
      *.example | *.test | *.invalid) continue ;;
      www.w3.org | ns.adobe.com | purl.org | schemas.xmlsoap.org | schemas.microsoft.com | xmlns.com) continue ;;
    esac
    printf '%s\t%s\n' "${path#"$root"/}" "${rest%%:*}" >>"$work/http.hits"
    if [ "$path" != "$prev" ]; then
      printf '%s\0' "$path" >>"$work/http.lst"
      prev=$path
    fi
  done <"$work/hits"
  [ -s "$work/http.hits" ] || return 0

  grep_hits "$work/http.lst" -o -E -e '^[[:space:]]*(//|/\*|\*|#|<!--)'
  while IFS= read -r -d '' path && IFS= read -r rest; do
    printf '%s\t%s\n' "${path#"$root"/}" "${rest%%:*}" >>"$work/comments"
  done <"$work/hits"
  awk -F "$TAB" -v OFS="$TAB" -v comments="$work/comments" -v hint="$H_HTTP" '
    BEGIN { while ((getline key < comments) > 0) c[key] = 1 }
    { print ((($1 FS $2) in c) ? 3 : 2), $1, $2, "http", hint }
  ' "$work/http.hits" >>"$findings"
}

# Likely credentials. Placeholders (example, your, xxxxx...) are skipped.
scan_secrets() {
  local path rest tok kind
  grep_hits "$work/all.lst" -o -E \
    -e '(^|[^A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}' \
    -e '(sk|rk)_live_[A-Za-z0-9]{20,}' \
    -e '(^|[^A-Za-z0-9])(AKIA|ASIA)[0-9A-Z]{16}([^0-9A-Za-z]|$)' \
    -e 'gh[pousr]_[A-Za-z0-9]{36,}' \
    -e 'github_pat_[A-Za-z0-9_]{40,}' \
    -e 'xox[abprs]-[A-Za-z0-9-]{10,}' \
    -e '-----BEGIN [A-Z ]*PRIVATE KEY( BLOCK)?-----' \
    -e 'nsec1[02-9ac-hj-np-z]{58}' \
    -e '[xyzt]prv[1-9A-HJ-NP-Za-km-z]{100,}'
  while IFS= read -r -d '' path && IFS= read -r rest; do
    tok=${rest#*:}
    tok=${tok#[!A-Za-z0-9-]}
    case "$tok" in
      *example* | *placeholder* | *your* | *xxxxx* | *dummy* | *redacted* | *changeme*) continue ;;
    esac
    case "$tok" in
      -----BEGIN*) kind=private-key ;;
      nsec1*) kind=nostr-nsec ;;
      [xyzt]prv*) kind=bip32-xprv ;;
      AKIA* | ASIA*) kind=aws ;;
      gh?_* | github_pat_*) kind=github ;;
      xox?-*) kind=slack ;;
      sk_live_* | rk_live_*) kind=stripe ;;
      sk-*)
        # Real keys contain digits; hyphenated words like "sk-foo-bar..." do not.
        case "$tok" in *[0-9]*) kind=api-key ;; *) continue ;; esac
        ;;
      *) kind=unknown ;;
    esac
    add 1 "$path" "${rest%%:*}" "secret:$kind" "$H_SECRET"
  done <"$work/hits"
}

# Real env files. Gitignored ones drop to LOW; tracked or unmanaged ones are HIGH.
scan_env_files() {
  local path
  find "$root" -mindepth 1 "${PRUNE[@]}" -o -type f \
    '(' -name .env -o -name '.env.*' -o -name '*.env' -o -name .dev.vars -o -name '.dev.vars.*' ')' \
    ! -name '*.example' ! -name '*.sample' ! -name '*.template' -print0 >"$work/env.lst"
  while IFS= read -r -d '' path; do
    if command -v git >/dev/null 2>&1 && git -C "${path%/*}" check-ignore -q -- "$path" 2>/dev/null; then
      add 3 "$path" 1 env-file "$H_ENV_IGNORED"
    else
      add 1 "$path" 1 env-file "$H_ENV"
    fi
  done <"$work/env.lst"
}

# Source maps inside build output directories (matched relative to <dir>).
scan_sourcemaps() {
  local path
  find "$root" -mindepth 1 "${PRUNE[@]}" -o -type f -name '*.map' -print0 >"$work/map.lst"
  while IFS= read -r -d '' path; do
    case "/${path#"$root"/}" in
      */dist/* | */build/* | */out/* | */.output/*) add 2 "$path" 1 sourcemap "$H_SOURCEMAP" ;;
    esac
  done <"$work/map.lst"
}

# --- run -------------------------------------------------------------------

mode=default
if [ "$strict" -eq 1 ]; then mode=strict; fi
printf 'opsec-audit: scanning %s (mode: %s)\n' "$root" "$mode"

find "$root" -mindepth 1 "${PRUNE[@]}" -o -type f ! -name '*.map' -print0 >"$work/all.lst"
# shellcheck disable=SC2086 # extension lists are meant to split into words
{
  find_ext "$work/web.lst" $WEB_EXTS
  find_ext "$work/pkg.lst" $WEB_EXTS json
  find_ext "$work/url.lst" $URL_EXTS
}

scan 1 analytics "$H_ANALYTICS" "$work/pkg.lst" -o -i -E -e "$RE_ANALYTICS"
scan 1 cdn-code "$H_CDN" "$work/web.lst" -o -i -E -e "$RE_CDN"
scan 2 cdn-font "$H_FONT" "$work/web.lst" -o -i -E -e "$RE_FONT"
scan 2 map-tiles "$H_TILES" "$work/web.lst" -o -i -E -e "$RE_TILES"
scan 2 console-secret "$H_CONSOLE" "$work/web.lst" -o -i -E -e "$RE_CONSOLE"
scan 1 storage-secret "$H_STORAGE" "$work/web.lst" -o -i -E -e "$RE_STORAGE"
scan_http
scan_secrets
scan_env_files
scan_sourcemaps

# A marker with a reason suppresses findings on its own line and the line
# below. Suppressed findings go to their own file so they can be listed.
: >"$work/allow"
if [ -s "$findings" ]; then
  grep_hits "$work/all.lst" -E -e "$RE_ALLOW"
  while IFS= read -r -d '' path && IFS= read -r rest; do
    line=${rest%%:*}
    printf '%s\t%s\n%s\t%s\n' "${path#"$root"/}" "$line" "${path#"$root"/}" "$((line + 1))" >>"$work/allow"
  done <"$work/hits"
fi
sort -u "$findings" | awk -F "$TAB" -v allow="$work/allow" -v supp="$work/suppressed" '
  BEGIN { while ((getline key < allow) > 0) ok[key] = 1; printf "" > supp }
  ($2 FS $3) in ok { print > supp; next }
  { print }
' | sort -t "$TAB" -k1,1n -k2,2 -k3,3n -k4,4 >"$work/report"

nhigh=0
nmed=0
nlow=0
while IFS="$TAB" read -r rank rel line rule hint; do
  case "$rank" in
    1) sev=HIGH nhigh=$((nhigh + 1)) ;;
    2) sev=MED nmed=$((nmed + 1)) ;;
    *) sev=LOW nlow=$((nlow + 1)) ;;
  esac
  printf '%-4s  %s:%s  [%s]  %s\n' "$sev" "$rel" "$line" "$rule" "$hint"
done <"$work/report"

nsupp=0
while IFS="$TAB" read -r _ rel line rule _; do
  nsupp=$((nsupp + 1))
  printf 'ALLOW %s:%s  [%s]  suppressed by allow marker\n' "$rel" "$line" "$rule"
done <"$work/suppressed"

total=$((nhigh + nmed + nlow))
nfiles=$(tr -cd '\000' <"$work/all.lst" | wc -c | tr -d ' ')
if [ "$total" -eq 0 ]; then printf 'No findings.\n'; fi
printf 'Summary: %d HIGH, %d MED, %d LOW (%d findings, %d suppressed, %s files scanned)\n' \
  "$nhigh" "$nmed" "$nlow" "$total" "$nsupp" "$nfiles"

if [ "$nhigh" -gt 0 ] || { [ "$strict" -eq 1 ] && [ "$total" -gt 0 ]; }; then
  printf 'Result: FAIL\n'
  exit 1
fi
printf 'Result: PASS\n'
