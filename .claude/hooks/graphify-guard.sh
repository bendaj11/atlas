#!/usr/bin/env bash
# PreToolUse guard: block raw search until graphify query/path/explain ran once this session.
# Falls open when graphify or graphify-out/graph.json is unavailable.
input=$(cat)

graph="${CLAUDE_PROJECT_DIR:-$PWD}/graphify-out/graph.json"
[ -f "$graph" ] || exit 0
command -v graphify >/dev/null 2>&1 || [ -x "$HOME/.local/bin/graphify" ] || exit 0

session=$(printf '%s' "$input" | jq -r '.session_id // "nosession"')
tool=$(printf '%s' "$input" | jq -r '.tool_name // ""')
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
marker="${TMPDIR:-/tmp}/graphify-guard-${session}"

deny() {
  jq -cn --arg reason "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
  exit 0
}

case "$tool" in
  Bash)
    if printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_./-])graphify[[:space:]]+(query|path|explain|update)'; then
      touch "$marker"
      exit 0
    fi
    [ -f "$marker" ] && exit 0
    if printf '%s' "$cmd" | grep -Eq '(^|[[:space:];&|(])(grep|rg|ag|find|fd|cat|head|tail|sed|awk|ls|tree)([[:space:]]|$)'; then
      deny "graphify-out/graph.json exists. Run graphify query \"<question>\" (or graphify path / graphify explain) first. Raw grep/find/cat unlocks after that for this session."
    fi
    ;;
  Grep|Glob)
    [ -f "$marker" ] && exit 0
    deny "graphify-out/graph.json exists. Run graphify query \"<question>\" via Bash first. Grep/Glob unlock after that for this session."
    ;;
esac

exit 0
