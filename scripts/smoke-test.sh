#!/usr/bin/env bash
# End-to-end smoke test of a running stack, through the public HTTP API:
# register -> sign in -> upload a generated WAV -> analyze (real
# python-engine) -> save a tone -> library -> shared page while logged out.
#
#   BASE_URL=http://localhost:3000 scripts/smoke-test.sh
#
# Needs bash, curl and python3 (standard library only).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
JAR="$WORK/cookies.txt"
EMAIL="smoke-$(date +%s)-$RANDOM@resoniq.test"
PASSWORD="smoke-$(python3 -c 'import secrets; print(secrets.token_hex(12))')"

step() { printf '\n== %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

step "landing page"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/")
[ "$code" = 200 ] || fail "GET / returned $code"
curl -s -D - -o /dev/null "$BASE_URL/" | grep -qi '^content-security-policy:.*nonce-' || fail "no nonce CSP on /"

step "register $EMAIL"
code=$(curl -s -o "$WORK/reg.json" -w '%{http_code}' -X POST "$BASE_URL/api/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
[ "$code" = 201 ] || fail "register returned $code: $(cat "$WORK/reg.json")"

step "sign in"
csrf=$(curl -s -c "$JAR" -b "$JAR" "$BASE_URL/api/auth/csrf" | json 'd["csrfToken"]')
curl -s -c "$JAR" -b "$JAR" -o /dev/null -X POST "$BASE_URL/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=$csrf" --data-urlencode "email=$EMAIL" --data-urlencode "password=$PASSWORD"
user_id=$(curl -s -b "$JAR" "$BASE_URL/api/auth/session" | json 'd["user"]["id"]') || fail "not signed in"
echo "user $user_id"

step "upload a generated 4s WAV"
python3 - "$WORK/riff.wav" <<'PY'
import math, struct, sys, wave
sr = 22050
frames = bytearray()
for n in range(sr * 4):
    t = n / sr
    f = (110.0, 146.8, 196.0, 220.0)[int(t) % 4]
    env = math.exp(-(t % 1.0) * 3)
    s = sum(math.sin(2 * math.pi * f * k * t) / k for k in (1, 2, 3)) * env
    s = max(-1.0, min(1.0, s * 4)) * 0.8  # clipped, like a driven amp
    frames += struct.pack("<h", int(s * 32767))
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes(bytes(frames))
PY
code=$(curl -s -b "$JAR" -o "$WORK/up.json" -w '%{http_code}' -F "file=@$WORK/riff.wav;type=audio/wav" "$BASE_URL/api/upload")
[ "$code" = 201 ] || fail "upload returned $code: $(cat "$WORK/up.json")"
song_id=$(json 'd["analysisJobId"]' < "$WORK/up.json")
echo "song $song_id"

step "analyze"
code=$(curl -s -b "$JAR" -o "$WORK/an.json" -w '%{http_code}' -X POST "$BASE_URL/api/analyze" \
  -H 'Content-Type: application/json' -d "{\"songId\":\"$song_id\"}")
[ "$code" = 200 ] || fail "analyze returned $code: $(cat "$WORK/an.json")"
json '"status=%s gain=%s amp=%r recipe=%s" % (d["song"]["status"], d["song"]["analysisData"]["tone_profile"]["gain_percent"], d["song"]["analysisData"]["tone_profile"]["amp_family"], d["song"]["analysisData"]["recipe"]["source"])' < "$WORK/an.json"
[ "$(json 'd["song"]["status"]' < "$WORK/an.json")" = ANALYZED ] || fail "song not ANALYZED"

step "audio is owner-only"
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-43' "$BASE_URL/api/songs/$song_id/audio")
[ "$code" = 206 ] || fail "owner range request returned $code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/songs/$song_id/audio")
[ "$code" = 401 ] || fail "anonymous audio request returned $code"

step "save tone"
python3 - "$WORK/an.json" "$song_id" > "$WORK/tone.json" <<'PY'
import json, sys
recipe = json.load(open(sys.argv[1]))["song"]["analysisData"]["recipe"]
recipe.pop("source")
print(json.dumps({"name": "Smoke test tone", "songId": sys.argv[2], "data": {"version": 2, "recipe": recipe}}))
PY
code=$(curl -s -b "$JAR" -o "$WORK/saved.json" -w '%{http_code}' -X POST "$BASE_URL/api/tones" \
  -H 'Content-Type: application/json' --data @"$WORK/tone.json")
[ "$code" = 201 ] || fail "save returned $code: $(cat "$WORK/saved.json")"
tone_id=$(json 'd["tone"]["id"]' < "$WORK/saved.json")

step "library search, favorite, rename"
[ "$(curl -s -b "$JAR" "$BASE_URL/api/tones?q=smoke" | json 'len(d["tones"])')" = 1 ] || fail "tone not found by search"
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' -X PATCH "$BASE_URL/api/tones/$tone_id" \
  -H 'Content-Type: application/json' -d '{"favorite":true,"name":"Smoke test tone (renamed)"}')
[ "$code" = 200 ] || fail "patch returned $code"

step "shared page, logged out"
curl -s "$BASE_URL/t/$tone_id" > "$WORK/shared.html"
grep -q "Smoke test tone (renamed)" "$WORK/shared.html" || fail "shared page missing tone name"
if grep -q "$EMAIL" "$WORK/shared.html"; then fail "shared page leaks the owner's email"; fi
if grep -q "$user_id" "$WORK/shared.html"; then fail "shared page leaks the owner's id"; fi

step "delete"
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' -X DELETE "$BASE_URL/api/tones/$tone_id")
[ "$code" = 200 ] || fail "delete returned $code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/t/$tone_id")
[ "$code" = 404 ] || fail "deleted tone page returned $code"

printf '\nSMOKE TEST PASSED\n'
