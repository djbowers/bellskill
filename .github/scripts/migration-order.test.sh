#!/usr/bin/env bash
#
# Tests for the migration-order comparison primitives. No dependencies -- run it
# directly:  .github/scripts/migration-order.test.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/migration-order.sh
source "${SCRIPT_DIR}/migration-order.sh"

passed=0
failed=0

ok() {
  passed=$((passed + 1))
  echo "  ok - $1"
}

fail() {
  failed=$((failed + 1))
  echo "  NOT OK - $1"
}

expect_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    ok "$label"
  else
    fail "$label (expected '${expected}', got '${actual}')"
  fi
}

expect_lt() {
  if version_lt "$1" "$2"; then ok "$1 < $2"; else fail "$1 < $2 (was not)"; fi
}

expect_not_lt() {
  if version_lt "$1" "$2"; then fail "$1 !< $2 (but compared less)"; else ok "$1 !< $2"; fi
}

echo "version_lt: the real incident"
# PR #121 (181755) vs the ceiling PR #122 (181819) raised on 2026-07-14.
expect_lt 20260713181755 20260713181819
expect_not_lt 20260713181819 20260713181755
expect_not_lt 20260713181819 20260713181819

echo "version_lt: adjacent and boundary values"
expect_lt 20260713181818 20260713181819
expect_lt 20260709000000 20260714000002
expect_not_lt 20260714000002 20260709000000

echo "version_lt: no integer overflow (bash -lt dies past 2^63)"
# Sanity-check the premise: the arithmetic operator really does blow up here.
if [ 202607131817550000000000 -lt 202607131817560000000000 ] 2>/dev/null; then
  fail "premise: expected bash -lt to overflow on a 24-digit version"
else
  ok "premise: bash -lt overflows on a 24-digit version, string compare must not"
fi
expect_lt 202607131817550000000000 202607131817560000000000
expect_not_lt 202607131817560000000000 202607131817550000000000
expect_lt 9223372036854775807 9223372036854775808

echo "version_lt: mixed widths compare numerically, not lexically"
# Lexically "9" > "10"; numerically 9 < 10. Zero-padding is what fixes this.
expect_lt 9 10
expect_not_lt 10 9
expect_lt 999 1000

echo "version_lt: leading zeros are decimal, never octal"
expect_lt 0000000000000008 0000000000000009
expect_not_lt 010 8

echo "max_version"
expect_eq "picks the highest" "20260713181819" \
  "$(printf '%s\n' 20260713181755 20260713181819 20260709000000 | max_version)"
expect_eq "empty stdin yields empty" "" "$(printf '' | max_version)"
expect_eq "single value" "20260101000000" "$(printf '%s\n' 20260101000000 | max_version)"
expect_eq "blank lines ignored" "20260101000000" \
  "$(printf '%s\n\n%s\n' 20260101000000 '' | max_version)"

echo "violations_below_ceiling: the failing case actually fails"
stale="$(printf '%s\n' \
  supabase/migrations/20260713181755_seed_snatch.sql \
  | violations_below_ceiling 20260713181819)"
expect_eq "stale migration is reported" \
  "20260713181755 supabase/migrations/20260713181755_seed_snatch.sql" "$stale"

echo "violations_below_ceiling: the passing case actually passes"
clean="$(printf '%s\n' \
  supabase/migrations/20260714000002_seed_easy_strength.sql \
  supabase/migrations/20260715090000_add_thing.sql \
  | violations_below_ceiling 20260713181819)"
expect_eq "migrations above the ceiling are silent" "" "$clean"

echo "violations_below_ceiling: mixed batch reports only the stale ones"
mixed="$(printf '%s\n' \
  supabase/migrations/20260101000000_old.sql \
  supabase/migrations/20260715090000_new.sql \
  supabase/migrations/20260713181755_also_old.sql \
  | violations_below_ceiling 20260713181819 | wc -l | tr -d ' ')"
expect_eq "two of three are stale" "2" "$mixed"

echo "violations_below_ceiling: equal to the ceiling is not below it"
equal="$(printf '%s\n' supabase/migrations/20260713181819_seed_aa.sql \
  | violations_below_ceiling 20260713181819)"
expect_eq "version == ceiling passes" "" "$equal"

echo "violations_below_ceiling: non-numeric and empty input"
expect_eq "unversioned filename is skipped" "" \
  "$(printf '%s\n' supabase/migrations/README.md | violations_below_ceiling 20260713181819)"
expect_eq "empty stdin yields nothing" "" \
  "$(printf '' | violations_below_ceiling 20260713181819)"

echo "migration_paths_only"
expect_eq "keeps only migration paths" "supabase/migrations/20260101000000_a.sql" \
  "$(printf '%s\n' src/App.tsx supabase/migrations/20260101000000_a.sql supabase/seed.sql \
    | migration_paths_only)"
expect_eq "no migration paths yields empty" "" \
  "$(printf '%s\n' src/App.tsx supabase/seed.sql | migration_paths_only)"

echo "ceiling_from_tree: against this repo's real HEAD"
real_ceiling="$(ceiling_from_tree HEAD)"
if [ -n "$real_ceiling" ]; then
  ok "HEAD has a ceiling: ${real_ceiling}"
else
  fail "HEAD should have a migration ceiling"
fi

echo "ceiling_from_tree: a tree with no migrations yields empty, not an error"
empty_ceiling="$(ceiling_from_tree "$(git hash-object -t tree /dev/null)")"
expect_eq "empty tree yields empty ceiling" "" "$empty_ceiling"

echo
echo "passed: ${passed}  failed: ${failed}"
[ "$failed" -eq 0 ]
