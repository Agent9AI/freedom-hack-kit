#!/usr/bin/env bash
# event-day-swarm.sh: start the event-day ruflo swarm from the frozen spec and
# print a ready-to-paste Claude Code prompt that spawns the build agents.
#
# Usage: scripts/event-day-swarm.sh <spec.md> [--agents N] [--dry-run]
#
#   1. ruflo swarm init    hierarchical topology, specialized strategy, N max agents
#   2. ruflo memory store  spec content into namespace "event-build", key "spec"
#   3. print the Claude Code prompt (architect first, then the rest in parallel)
#
# ruflo flags checked against --help for swarm init, memory store and memory
# retrieve (ruflo v3.38.20). ruflo can print [ERROR] and still exit 0, so the
# output is checked as well as the exit code.
# Exit codes: 0 ok, 1 bad spec file, 2 bad arguments, 3 ruflo failed.
# Tests: tests/runbook/test-event-day-swarm.sh (validation and dry run only).

set -euo pipefail
unset CDPATH

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

DEFAULT_AGENTS=5
MIN_AGENTS=2
MAX_AGENTS=8
MAX_SPEC_BYTES=65536
NAMESPACE="event-build"
SPEC_KEY="spec"

# Priority order: --agents N takes the first N roles.
ROLE_NAMES=(architect coder-1 opsec-reviewer tester coder-2 i18n deployer docs-writer)
ROLE_TASKS=(
  "Read the spec, src/starter and src/rails. Write docs/plan.md: the core loop mapped to files, which kit modules are reused as they are, the interfaces between pieces, and a file-ownership table for every other agent. No app code."
  "Build the user-facing core loop screens on the src/starter PWA shell (offline, i18n/RTL and panic wipe are already in it). Edit only the UI paths docs/plan.md gives you."
  "Read-only review of the build against docs/security/ACTIVIST_THREAT_CHECKLIST.md and the spec's must-never-happen list. Run scripts/opsec-audit.sh. Report each finding with file:line and severity. Do not edit files."
  "Write tests for the core loop with mocks only, in the test paths docs/plan.md gives you. Run them. Report failures against the owning agent's paths; do not change app code."
  "Build the AI step and data flow: the src/starter private LLM client (OpenAI-compatible base URL, no hardcoded keys), plus src/rails Nostr or Nostr Wallet Connect only if the spec asks for them. Edit only the paths docs/plan.md gives you."
  "Move every user-facing string into the src/starter i18n files, add the spec's languages, and check right-to-left layout. Mark machine translations as needing review by a native speaker before Friday."
  "Make the build deploy to a real URL: Cloudflare first, Vercel as backup. Secrets go through wrangler secret or the host's env settings, never into the repo. Report the URL and the exact redeploy commands."
  "Draft README.md (problem, live URL, run locally, self-host, prepared before the event vs built here) and docs/HANDOFF.md from the template in docs/runbook/SUBMISSION_CHECKLIST.md."
)

usage() {
  cat <<'EOF'
Usage: scripts/event-day-swarm.sh <spec.md> [--agents N] [--dry-run]

  <spec.md>    Frozen event spec: a regular file inside this project.
  --agents N   Build agents to plan for, 2 to 8 (default 5). Values above 8 are capped.
  --dry-run    Print the commands and the prompt; execute nothing.
  -h, --help   Show this help.
EOF
}

fail() { printf 'error: %s\n' "$1" >&2; exit 1; }
usage_fail() { printf 'error: %s\n\n' "$1" >&2; usage >&2; exit 2; }
ruflo_fail() { printf 'error: %s\n' "$1" >&2; exit 3; }

# ---- arguments --------------------------------------------------------------

SPEC_ARG=""
AGENTS="$DEFAULT_AGENTS"
DRY_RUN=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --agents)
      [ "$#" -ge 2 ] || usage_fail "--agents needs a value"
      AGENTS="$2"
      shift 2
      ;;
    --agents=*) AGENTS="${1#--agents=}"; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) usage_fail "unknown option: $1" ;;
    *)
      [ -z "$SPEC_ARG" ] || usage_fail "only one spec path is allowed"
      SPEC_ARG="$1"
      shift
      ;;
  esac
done

[ -n "$SPEC_ARG" ] || usage_fail "missing <spec.md>"

case "$AGENTS" in
  ''|*[!0-9]*) usage_fail "--agents must be a whole number from $MIN_AGENTS to $MAX_AGENTS, got '$AGENTS'" ;;
esac
while [ "${#AGENTS}" -gt 1 ] && [ "${AGENTS#0}" != "$AGENTS" ]; do AGENTS="${AGENTS#0}"; done
if [ "${#AGENTS}" -gt 2 ] || [ "$AGENTS" -gt "$MAX_AGENTS" ]; then
  printf 'warning: --agents %s is above the cap, using %s\n' "$AGENTS" "$MAX_AGENTS" >&2
  AGENTS="$MAX_AGENTS"
fi
[ "$AGENTS" -ge "$MIN_AGENTS" ] || usage_fail "--agents must be at least $MIN_AGENTS (architect plus one builder), got '$AGENTS'"

# ---- spec file --------------------------------------------------------------

if [ -L "$SPEC_ARG" ]; then
  fail "spec must be a regular file, not a symlink: $SPEC_ARG"
elif [ ! -e "$SPEC_ARG" ]; then
  fail "spec not found: $SPEC_ARG"
elif [ ! -f "$SPEC_ARG" ]; then
  fail "spec is not a regular file: $SPEC_ARG"
elif [ ! -r "$SPEC_ARG" ]; then
  fail "spec is not readable: $SPEC_ARG"
fi

# Resolve physically (symlinked directories included), then require the result
# to sit inside the project. This rejects ../ traversal and outside paths.
SPEC_DIR="$(cd -- "$(dirname -- "$SPEC_ARG")" && pwd -P)" || fail "cannot resolve spec directory: $SPEC_ARG"
SPEC_PATH="$SPEC_DIR/$(basename -- "$SPEC_ARG")"
case "$SPEC_PATH" in
  "$PROJECT_DIR"/*) ;;
  *) fail "spec must be inside the project directory $PROJECT_DIR: $SPEC_ARG" ;;
esac
SPEC_REL="${SPEC_PATH#"$PROJECT_DIR"/}"
case "$SPEC_REL" in
  *[!A-Za-z0-9._/-]*) fail "spec path may only use letters, digits, dot, dash, underscore and slash: $SPEC_REL" ;;
esac

SPEC_BYTES="$(wc -c < "$SPEC_PATH" | tr -d ' ')"
[ "$SPEC_BYTES" -gt 0 ] || fail "spec is empty: $SPEC_REL"
[ "$SPEC_BYTES" -le "$MAX_SPEC_BYTES" ] || fail "spec is $SPEC_BYTES bytes, over the $MAX_SPEC_BYTES byte limit (keep it to one page): $SPEC_REL"

# ---- commands ---------------------------------------------------------------

INIT_CMD=(ruflo swarm init --topology hierarchical --max-agents "$AGENTS" --strategy specialized)
STORE_FLAGS=(--provenance user_claim --scan-content --tags event-day,spec)
RETRIEVE_CMD=(ruflo memory retrieve --namespace "$NAMESPACE" --key "$SPEC_KEY" --value-only)

roster() {
  local i=0 sep=""
  while [ "$i" -lt "$AGENTS" ]; do
    printf '%s%s' "$sep" "${ROLE_NAMES[$i]}"
    sep=", "
    i=$((i + 1))
  done
}

print_commands() {
  # The stored value starts with a Source line: ruflo rejects a --value that
  # begins with a dash, and this also tells agents where the file lives.
  local nl_lit="\$'\\n\\n'"
  printf 'cd %q\n' "$PROJECT_DIR"
  printf '%s\n' "${INIT_CMD[*]}"
  printf 'ruflo memory store --namespace %s --key %s --value "Source: %s"%s"$(cat %s)" %s\n' \
    "$NAMESPACE" "$SPEC_KEY" "$SPEC_REL" "$nl_lit" "$SPEC_REL" "${STORE_FLAGS[*]}"
  printf '%s\n' "${RETRIEVE_CMD[*]}"
}

run_ruflo() {
  local label="$1" out status=0
  shift
  printf -- '-> %s\n' "$label"
  out="$("$@" 2>&1)" || status=$?
  printf '%s\n' "$out"
  [ "$status" -eq 0 ] || ruflo_fail "$label failed (exit $status)"
  case "$out" in
    *"[ERROR]"*) ruflo_fail "$label reported an error (see output above)" ;;
  esac
}

print_prompt() {
  local remaining=$((AGENTS - 1)) noun="agents" i=1
  if [ "$remaining" -eq 1 ]; then noun="agent"; fi

  printf 'You are the integrator for an AI Hack for Freedom event build in %s.\n' "$PROJECT_DIR"
  printf 'The frozen spec is %s, also stored in ruflo memory (namespace %s, key %s).\n' "$SPEC_REL" "$NAMESPACE" "$SPEC_KEY"
  printf 'A ruflo swarm is set up for it: hierarchical topology, specialized strategy, max %s agents.\n\n' "$AGENTS"
  cat <<'EOF'
The captain owns every product decision. Agents never make one. If the spec does not answer a question, the agent stops and reports it, and you ask me so I can ask the captain.

Step 1. Spawn the architect with the Agent tool in the foreground and wait for docs/plan.md. Show me the plan; I review it with the captain before step 2.

EOF
  printf 'Step 2. Spawn the remaining %s %s in ONE message, each with run_in_background: true. ' "$remaining" "$noun"
  cat <<'EOF'
Use a matching agent type if this project defines one (coder, tester, reviewer), otherwise general-purpose. After spawning, stop: do not poll. Review every result when it arrives, then run the tests and scripts/opsec-audit.sh yourself before any deploy.

Agents:
EOF
  printf -- '- %s: %s\n' "${ROLE_NAMES[0]}" "${ROLE_TASKS[0]}"
  while [ "$i" -lt "$AGENTS" ]; do
    printf -- '- %s: %s\n' "${ROLE_NAMES[$i]}" "${ROLE_TASKS[$i]}"
    i=$((i + 1))
  done
  cat <<'EOF'

Rules for every agent (copy them into each agent prompt):
1. Load the spec first: ruflo memory retrieve --namespace event-build --key spec --value-only (or read the spec file named on its Source line).
2. Reuse the kit instead of rewriting it. src/starter is the offline PWA shell, private LLM client, i18n/RTL and panic wipe. src/rails is Nostr identity, publish and encrypted DM, plus Nostr Wallet Connect Lightning.
3. Edit only the paths docs/plan.md assigns to you. Never touch files the captain is editing.
4. No secrets, API keys, nsec keys or wallet connection strings in files. Use .env.example with placeholder names.
5. No third-party network calls at runtime: no analytics, CDN scripts or web fonts. Outbound calls are limited to what the spec names (LLM base URL, Nostr relays, NWC wallet).
6. Tests use mocks. Never call a real LLM, relay or wallet from a test.
7. Keep files under 500 lines. No em-dashes in any text. Do not git commit; the integrator does.
8. Before handing off, run scripts/opsec-audit.sh and put its result in your report.
9. Final report under 150 words: files changed, test command and result, opsec audit result, open questions for the captain.
EOF
}

# ---- main -------------------------------------------------------------------

printf '== event-day-swarm ==\n'
printf 'Project: %s\n' "$PROJECT_DIR"
printf 'Spec:    %s (%s bytes)\n' "$SPEC_REL" "$SPEC_BYTES"
printf 'Agents:  %s (%s)\n' "$AGENTS" "$(roster)"

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'Mode:    DRY RUN, nothing is executed\n\n== Commands ==\n'
  print_commands
else
  command -v ruflo >/dev/null 2>&1 || ruflo_fail "ruflo not found on PATH (install: npm install -g ruflo)"
  printf 'Mode:    live\n\n== Running ==\n'
  # ruflo keeps swarm state and memory under the current directory (.swarm/).
  cd -- "$PROJECT_DIR"
  run_ruflo "swarm init" "${INIT_CMD[@]}"
  VALUE="Source: $SPEC_REL"$'\n\n'"$(cat "$SPEC_PATH")"
  run_ruflo "memory store ($NAMESPACE/$SPEC_KEY)" \
    ruflo memory store --namespace "$NAMESPACE" --key "$SPEC_KEY" --value "$VALUE" "${STORE_FLAGS[@]}"
  STORED="$("${RETRIEVE_CMD[@]}" 2>/dev/null)" \
    || ruflo_fail "spec not found in memory after storing (namespace $NAMESPACE, key $SPEC_KEY)"
  if [ "$STORED" != "$VALUE" ]; then
    printf 'warning: stored spec differs from %s; agents should read the file directly\n' "$SPEC_REL" >&2
  fi
  printf -- '-> spec verified in memory\n'
fi

printf '\n== Paste this into Claude Code ==\n-----8<-----\n'
print_prompt
printf -- '-----8<-----\n'
