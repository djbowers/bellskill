#!/usr/bin/env bash
#
# Shared ordering primitives for the Supabase migration-order guard.
#
# Sourced by the workflow jobs; also runnable as a CLI so the comparison can be
# exercised locally against fabricated version lists:
#
#   .github/scripts/migration-order.sh compare <a> <b>   -> prints lt|eq|gt
#   .github/scripts/migration-order.sh max               -> reads versions on stdin
#   .github/scripts/migration-order.sh ceiling <git-ref> -> highest version in that tree
#   .github/scripts/migration-order.sh violations <ceiling>  -> reads paths on stdin

set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"

version_of() {
  basename "$1" | grep -oE '^[0-9]+' || true
}

# Zero-pad to a common width so a lexical compare is exactly a numeric compare.
# Bash's own -lt overflows past 2^63 ("integer expression expected") and would
# take the guard down with it; string compare has no ceiling.
version_lt() {
  local a="$1"
  local b="$2"
  while [ "${#a}" -lt "${#b}" ]; do a="0${a}"; done
  while [ "${#b}" -lt "${#a}" ]; do b="0${b}"; done
  [[ "$a" < "$b" ]]
}

# Highest version from newline-separated versions on stdin. Empty stdin -> empty.
max_version() {
  local max=""
  local v
  while read -r v; do
    [ -n "$v" ] || continue
    if [ -z "$max" ] || version_lt "$max" "$v"; then
      max="$v"
    fi
  done
  printf '%s' "$max"
}

# Highest migration version committed in the given git ref. Empty if the ref has
# no migrations at all.
ceiling_from_tree() {
  local ref="$1"
  local files
  files="$(git ls-tree -r --name-only "$ref" -- "$MIGRATIONS_DIR" || true)"
  [ -n "$files" ] || return 0

  printf '%s\n' "$files" | while read -r file; do
    [ -n "$file" ] || continue
    version_of "$file"
  done | max_version
}

migration_paths_only() {
  grep -E "^${MIGRATIONS_DIR}/" || true
}

# Reads migration paths on stdin, prints "<version> <path>" for each one that
# sorts below $1. Callers decide by whether the output is empty -- deliberately
# not by exit code, since the read loop runs in a subshell when piped into.
violations_below_ceiling() {
  local ceiling="$1"
  local path
  local version

  while read -r path; do
    [ -n "$path" ] || continue
    version="$(version_of "$path")"
    [ -n "$version" ] || continue

    if version_lt "$version" "$ceiling"; then
      printf '%s %s\n' "$version" "$path"
    fi
  done
}

# Only run the CLI when executed directly, never when sourced.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  command="${1:-}"
  case "$command" in
    compare)
      if version_lt "${2:?a}" "${3:?b}"; then
        echo "lt"
      elif version_lt "$3" "$2"; then
        echo "gt"
      else
        echo "eq"
      fi
      ;;
    max) max_version; echo ;;
    ceiling) ceiling_from_tree "${2:?git ref}"; echo ;;
    violations) violations_below_ceiling "${2:?ceiling}" ;;
    *)
      echo "usage: $0 {compare <a> <b>|max|ceiling <ref>|violations <ceiling>}" >&2
      exit 64
      ;;
  esac
fi
