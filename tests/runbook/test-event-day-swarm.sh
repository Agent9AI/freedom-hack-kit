#!/usr/bin/env bash
# Tests for scripts/event-day-swarm.sh: argument validation and --dry-run only.
#
# Never starts a real swarm. The script is copied into a throwaway project, a
# fake `ruflo` that records every call sits first on PATH, and the suite asserts
# that fake was never invoked.
#
# Run: bash tests/runbook/test-event-day-swarm.sh

set -u

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
SCRIPT_SRC="$REPO_DIR/scripts/event-day-swarm.sh"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/event-day-swarm-test.XXXXXX")"
WORK="$(cd -- "$WORK" && pwd -P)"
trap 'rm -rf "$WORK"' EXIT

PROJ="$WORK/project"
MARKER="$WORK/ruflo-was-called"
mkdir -p "$PROJ/scripts" "$PROJ/docs/dir.md" "$WORK/fakebin" "$WORK/project-evil"
cp "$SCRIPT_SRC" "$PROJ/scripts/event-day-swarm.sh"
chmod +x "$PROJ/scripts/event-day-swarm.sh"

printf '# Event Spec\n\nFor trainers, we are building a lesson helper.\n' > "$PROJ/docs/spec.md"
printf -- '- a spec that starts with a dash\n' > "$PROJ/docs/dash.md"
: > "$PROJ/docs/empty.md"
head -c 70000 /dev/zero | tr '\0' 'a' > "$PROJ/docs/huge.md"
printf 'outside the project\n' > "$WORK/outside.md"
printf 'prefix trick\n' > "$WORK/project-evil/spec.md"
ln -s "$WORK/outside.md" "$PROJ/docs/link.md"
printf 'odd name\n' > "$PROJ/docs/odd name.md"

cat > "$WORK/fakebin/ruflo" <<EOF
#!/bin/sh
echo "\$*" >> "$MARKER"
exit 0
EOF
chmod +x "$WORK/fakebin/ruflo"

EMDASH="$(printf '\342\200\224')"
PASS=0
FAIL=0
OUT=""
CODE=0

run_in() {  # run_in <dir> <args...>: run the copied script from <dir>
  local dir="$1"
  shift
  OUT="$(cd -- "$dir" && PATH="$WORK/fakebin:$PATH" "$PROJ/scripts/event-day-swarm.sh" "$@" 2>&1)"
  CODE=$?
}
run() { run_in "$PROJ" "$@"; }

check() {  # check <name> <command...>
  local name="$1"
  shift
  if "$@"; then
    PASS=$((PASS + 1))
    printf 'ok   %s\n' "$name"
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL %s (exit %s)\n' "$name" "$CODE"
    printf '%s\n' "$OUT" | sed 's/^/       | /'
  fi
}
exit_is() { [ "$CODE" -eq "$1" ]; }
has() { case "$OUT" in *"$1"*) return 0 ;; esac; return 1; }
lacks() { ! has "$1"; }

# ---- static -----------------------------------------------------------------

check "script is executable" test -x "$SCRIPT_SRC"
check "script parses (bash -n)" bash -n "$SCRIPT_SRC"

# ---- usage ------------------------------------------------------------------

run
check "no arguments: exit 2" exit_is 2
check "no arguments: prints usage" has "Usage: scripts/event-day-swarm.sh"

run --help
check "--help: exit 0" exit_is 0

run docs/spec.md --agnets 5 --dry-run
check "unknown option: exit 2" exit_is 2
check "unknown option: named in error" has "unknown option: --agnets"

run docs/spec.md docs/dash.md --dry-run
check "two spec paths: exit 2" exit_is 2

# ---- spec validation --------------------------------------------------------

run docs/nope.md --dry-run
check "missing file: exit 1" exit_is 1
check "missing file: says not found" has "spec not found"

run docs/dir.md --dry-run
check "directory: exit 1" exit_is 1
check "directory: says not a regular file" has "not a regular file"

run ../outside.md --dry-run
check "traversal ../: exit 1" exit_is 1
check "traversal ../: says inside the project" has "must be inside the project directory"

run docs/../../outside.md --dry-run
check "traversal docs/../../: exit 1" exit_is 1

run "$WORK/outside.md" --dry-run
check "absolute path outside project: exit 1" exit_is 1

run ../project-evil/spec.md --dry-run
check "sibling dir sharing the project prefix: exit 1" exit_is 1
check "sibling dir: says inside the project" has "must be inside the project directory"

run docs/link.md --dry-run
check "symlink escaping the project: exit 1" exit_is 1
check "symlink: says not a symlink" has "not a symlink"

run docs/empty.md --dry-run
check "empty spec: exit 1" exit_is 1
check "empty spec: says empty" has "spec is empty"

run docs/huge.md --dry-run
check "oversized spec: exit 1" exit_is 1
check "oversized spec: says byte limit" has "byte limit"

run "docs/odd name.md" --dry-run
check "unsafe characters in path: exit 1" exit_is 1

# ---- --agents validation ----------------------------------------------------

for bad in abc 0 1 -3 5.5 "" " 5"; do
  run docs/spec.md --agents "$bad" --dry-run
  check "bad --agents '$bad': exit 2" exit_is 2
  check "bad --agents '$bad': names --agents" has "--agents must"
done

run docs/spec.md --dry-run --agents
check "--agents with no value: exit 2" exit_is 2

run docs/spec.md --agents 12 --dry-run
check "--agents 12: exit 0" exit_is 0
check "--agents 12: warns about the cap" has "above the cap, using 8"
check "--agents 12: capped to 8" has "--max-agents 8"

run docs/spec.md --agents 99999999999999999999 --dry-run
check "--agents huge: capped to 8" has "--max-agents 8"

run docs/spec.md --agents 007 --dry-run
check "--agents 007: read as 7" has "--max-agents 7"

# ---- happy path dry run -----------------------------------------------------

run docs/spec.md --dry-run
check "happy path: exit 0" exit_is 0
check "happy path: says DRY RUN" has "DRY RUN, nothing is executed"
check "happy path: default 5 agents" has "Agents:  5 (architect, coder-1, opsec-reviewer, tester, coder-2)"
check "happy path: swarm init command" has "ruflo swarm init --topology hierarchical --max-agents 5 --strategy specialized"
check "happy path: memory store command" has "ruflo memory store --namespace event-build --key spec --value"
check "happy path: memory store flags" has "--provenance user_claim --scan-content --tags event-day,spec"
check "happy path: retrieve check command" has "ruflo memory retrieve --namespace event-build --key spec --value-only"
check "happy path: cd into project" has "cd $PROJ"
check "prompt: architect first in foreground" has "Spawn the architect with the Agent tool in the foreground"
check "prompt: remaining 4 in one message" has "Spawn the remaining 4 agents in ONE message"
check "prompt: run_in_background" has "run_in_background: true"
for role in "architect:" "coder-1:" "coder-2:" "tester:" "opsec-reviewer:"; do
  check "prompt: role $role" has "- $role"
done
check "prompt: no i18n role at 5 agents" lacks "- i18n:"
check "prompt: reuses src/starter" has "src/starter"
check "prompt: reuses src/rails" has "src/rails"
check "prompt: runs opsec audit before handoff" has "run scripts/opsec-audit.sh and put its result in your report"
check "output: no em-dashes" lacks "$EMDASH"
check "dry run: ruflo never called" test ! -e "$MARKER"
check "dry run: no .swarm state created" test ! -e "$PROJ/.swarm"

run docs/spec.md --agents 3 --dry-run
check "--agents 3: max-agents 3" has "--max-agents 3"
check "--agents 3: keeps opsec-reviewer" has "- opsec-reviewer:"
check "--agents 3: drops coder-2" lacks "- coder-2:"

run docs/spec.md --agents 2 --dry-run
check "--agents 2: singular noun" has "Spawn the remaining 1 agent in ONE message"

run --dry-run --agents=8 docs/spec.md
check "--agents=8 before spec: exit 0" exit_is 0
check "--agents=8: docs-writer included" has "- docs-writer:"

run docs/dash.md --dry-run
check "dash-leading spec: stored value gets a Source line" has '--value "Source: docs/dash.md"'

run_in "$WORK" project/docs/spec.md --dry-run
check "relative path from another cwd: exit 0" exit_is 0
check "relative path from another cwd: resolved" has "Spec:    docs/spec.md"

run_in "$WORK" "$PROJ/docs/spec.md" --dry-run
check "absolute path inside project: exit 0" exit_is 0

check "whole suite: ruflo never called" test ! -e "$MARKER"

printf '\n%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
