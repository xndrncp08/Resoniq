#!/usr/bin/env bash
# End-to-end test of the community platform against a running stack
# (frontend + worker + Postgres; the analysis engine isn't needed):
#   two members sign up -> profiles -> follow -> declared-rig tone ->
#   video upload (processed by the worker with ffmpeg) -> post in a community
#   -> amp, comment, reply, bookmark -> notifications -> search -> report ->
#   public visibility checks -> both accounts deleted.
#
#   BASE_URL=http://localhost:3000 scripts/e2e-platform.sh
#
# Needs bash, curl, python3 and ffmpeg (to generate the test clip). The
# communities must be seeded (npm run db:seed).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
step() { printf '\n== %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }
STAMP="$(date +%s)$RANDOM"

# api JAR METHOD PATH [JSON] -> body on stdout; fails on non-2xx
api() {
  local jar=$1 method=$2 path=$3 body=${4:-}
  local code
  if [ -n "$body" ]; then
    code=$(curl -s -b "$jar" -c "$jar" -o "$WORK/out.json" -w '%{http_code}' -X "$method" "$BASE_URL$path" -H 'Content-Type: application/json' -d "$body")
  else
    code=$(curl -s -b "$jar" -c "$jar" -o "$WORK/out.json" -w '%{http_code}' -X "$method" "$BASE_URL$path")
  fi
  [[ "$code" =~ ^2 ]] || fail "$method $path returned $code: $(cat "$WORK/out.json")"
  cat "$WORK/out.json"
}

signup() {
  local jar=$1 name=$2 email="e2e-$STAMP-$2@resoniq.test" password="e2e-pass-$STAMP"
  api "$jar" POST /api/register "{\"name\":\"$name $STAMP\",\"email\":\"$email\",\"password\":\"$password\"}" >/dev/null
  local csrf
  csrf=$(curl -s -c "$jar" -b "$jar" "$BASE_URL/api/auth/csrf" | json 'd["csrfToken"]')
  curl -s -c "$jar" -b "$jar" -o /dev/null -X POST "$BASE_URL/api/auth/callback/credentials" \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "email=$email" --data-urlencode "password=$password"
  echo "$password"
}

A="$WORK/a.txt"; B="$WORK/b.txt"
step "sign up two members"
PASS_A=$(signup "$A" Ada)
PASS_B=$(signup "$B" Bo)
HANDLE_A=$(api "$A" GET /api/me | json 'd["profile"]["handle"]')
HANDLE_B=$(api "$B" GET /api/me | json 'd["profile"]["handle"]')
echo "@$HANDLE_A and @$HANDLE_B"

step "edit profile; public profile hides email"
api "$A" PATCH /api/me '{"bio":"Tele into a cranked tweed. #twang","instruments":["electric-guitar"],"genres":["country","blues"]}' >/dev/null
curl -s "$BASE_URL/api/users/$HANDLE_A" | grep -q "resoniq.test" && fail "public profile leaked an email"
api "$B" PUT "/api/users/$HANDLE_A/follow" | json 'd["followerCount"]' | grep -qx 1 || fail "follow count"

step "practice room and editable conversation prompts"
curl -fsS "$BASE_URL/practice" > "$WORK/practice.html"
grep -q 'Find your pocket' "$WORK/practice.html" || fail "practice room missing"
curl -fsS -b "$A" "$BASE_URL/new?prompt=feedback" > "$WORK/feedback.html"
grep -q 'Get fresh ears' "$WORK/feedback.html" || fail "feedback prompt heading missing"
grep -q 'What I have tried:' "$WORK/feedback.html" || fail "feedback template missing"
curl -fsS -b "$A" "$BASE_URL/new?prompt=collaboration" > "$WORK/collaboration.html"
grep -q 'Who I am looking for:' "$WORK/collaboration.html" || fail "collaboration template missing"

step "create a public tone with a declared rig"
TONE=$(api "$A" POST /api/tones '{"name":"Tweed edge '"$STAMP"'","visibility":"PUBLIC","description":"Volume on 7, pick hard","rig":{"instrument":{"kind":"GUITAR","ref":{"model":"Telecaster"},"pickupPosition":"Bridge"},"chain":[{"category":"compressor","params":{"Sustain":4,"Level":6}},{"category":"drive","ref":{"model":"Klon-style"},"params":{"Gain":3}}],"amp":{"ref":{"model":"5E3 Tweed Deluxe"},"settings":{"Volume":7,"Tone":6}}}}' | json 'd["tone"]["id"]')
echo "tone $TONE"
curl -fsS "$BASE_URL/practice?tone=$TONE" > "$WORK/practice-tone.html"
grep -q 'Your sound for this session' "$WORK/practice-tone.html" || fail "practice tone context missing"
grep -q 'noindex' "$WORK/practice-tone.html" || fail "tone-specific practice session is indexable"

PRIVATE_TONE=$(api "$A" POST /api/tones '{"name":"Private practice QA '"$STAMP"'","visibility":"PRIVATE","rig":{"chain":[],"notes":"Private practice note"}}' | json 'd["tone"]["id"]')
curl -fsS -b "$A" "$BASE_URL/practice?tone=$PRIVATE_TONE" > "$WORK/private-practice.html"
grep -q "Private practice QA $STAMP" "$WORK/private-practice.html" || fail "owner cannot practice with private tone"
curl -fsS "$BASE_URL/practice?tone=$PRIVATE_TONE" > "$WORK/guest-practice.html"
if grep -q "Private practice QA $STAMP" "$WORK/guest-practice.html"; then fail "private tone leaked through practice page"; fi

step "upload a generated video"
ffmpeg -y -v error -f lavfi -i testsrc=size=640x360:rate=24 -f lavfi -i sine=frequency=196 -t 5 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$WORK/take.mp4"
SIZE=$(wc -c < "$WORK/take.mp4" | tr -d ' ')
UP=$(api "$A" POST /api/media "{\"kind\":\"VIDEO\",\"size\":$SIZE,\"mime\":\"video/mp4\"}")
MEDIA=$(echo "$UP" | json 'd["id"]')
URL=$(echo "$UP" | json 'd["upload"]["url"]')
case "$URL" in http*) ;; *) URL="$BASE_URL$URL" ;; esac
code=$(curl -s -b "$A" -o "$WORK/put.json" -w '%{http_code}' -X PUT "$URL" -H 'Content-Type: application/octet-stream' --data-binary "@$WORK/take.mp4")
[[ "$code" =~ ^2 ]] || fail "upload PUT returned $code: $(cat "$WORK/put.json")"
api "$A" POST "/api/media/$MEDIA/complete" >/dev/null

step "renamed text file is refused"
echo "not a video" > "$WORK/fake.mp4"
BAD=$(api "$A" POST /api/media '{"kind":"VIDEO","size":12,"mime":"video/mp4"}' | json 'd["id"]')
code=$(curl -s -b "$A" -o /dev/null -w '%{http_code}' -X PUT "$BASE_URL/api/media/$BAD/content" -H 'Content-Type: application/octet-stream' --data-binary "@$WORK/fake.mp4")
[ "$code" = 415 ] || fail "fake video got $code, expected 415"

step "post the performance in c/country with the tone attached"
POST=$(api "$A" POST /api/posts "{\"title\":\"Tweed take $STAMP\",\"body\":\"First pass on the new board. #tweed @$HANDLE_B\",\"category\":\"PERFORMANCE\",\"community\":\"country\",\"mediaIds\":[\"$MEDIA\"],\"toneId\":\"$TONE\"}" | json 'd["post"]["id"]')
echo "post $POST"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/posts/$POST")
[ "$code" = 404 ] || fail "processing post visible to the public ($code)"

step "wait for the worker to process the video"
for i in $(seq 1 60); do
  status=$(api "$A" GET "/api/media/$MEDIA" | json 'd["media"]["status"]')
  [ "$status" = READY ] && break
  [ "$status" = FAILED ] && fail "media processing failed: $(cat "$WORK/out.json")"
  sleep 2
done
[ "$status" = READY ] || fail "media still $status after 120s (is the worker running?)"
curl -s "$BASE_URL/api/posts/$POST" | json 'd["post"]["status"]' | grep -qx PUBLISHED || fail "post not published after processing"
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-1023' "$BASE_URL/api/media/$MEDIA/playback")
[ "$code" = 206 ] || fail "range playback returned $code"
curl -s -D "$WORK/media-headers.txt" -o /dev/null -H 'Range: bytes=0-1023' "$BASE_URL/api/media/$MEDIA/playback"
grep -qi '^cache-control:.*no-store' "$WORK/media-headers.txt" || fail "media can be cached after access is revoked"
curl -s "$BASE_URL/api/posts/$POST" | json 'd["post"]["tone"]["declared"]["blocks"]' | grep -qx 2 || fail "tone summary missing on post"

step "amp, comment, reply, bookmark"
api "$B" PUT "/api/posts/$POST/vote" '{"value":1}' | json 'd["score"]' | grep -qx 1 || fail "vote"
C1=$(api "$B" POST "/api/posts/$POST/comments" '{"body":"That compressor before the drive is the trick."}' | json 'd["comment"]["id"]')
api "$A" POST "/api/posts/$POST/comments" "{\"body\":\"Yep, sustain on 4.\",\"parentId\":\"$C1\"}" >/dev/null
api "$B" PUT "/api/posts/$POST/bookmark" >/dev/null
api "$B" GET /api/bookmarks | json 'len(d["items"])' | grep -qx 1 || fail "bookmark list"
api "$B" PUT "/api/tones/$TONE/save" >/dev/null
api "$B" POST "/api/tones/$TONE/remix" | json 'd["tone"]["id"]' >/dev/null

step "notifications arrive"
types=$(api "$A" GET /api/notifications | json '",".join(sorted({n["type"] for n in d["items"]}))')
for t in FOLLOW COMMENT TONE_SAVE TONE_REMIX MEDIA_READY; do [[ ",$types," == *",$t,"* ]] || fail "missing $t notification ($types)"; done
api "$B" GET /api/notifications | json '",".join(n["type"] for n in d["items"])' | grep -q MENTION || fail "mention notification"
api "$B" GET /api/notifications | json '",".join(n["type"] for n in d["items"])' | grep -q REPLY || fail "reply notification"

step "feeds and search"
api "$B" GET "/api/feed?tab=following" | json '[p["id"] for p in d["items"]]' | grep -q "$POST" || fail "following feed"
curl -s "$BASE_URL/api/search?q=tweed%20take%20$STAMP&type=posts" | json '[p["id"] for p in d["items"]]' | grep -q "$POST" || fail "search"
curl -s "$BASE_URL/api/tones/public?q=Tweed%20edge%20$STAMP" | json '[t["id"] for t in d["items"]]' | grep -q "$TONE" || fail "tone discovery"

step "reports and permission edges"
api "$B" POST /api/reports "{\"targetType\":\"POST\",\"targetId\":\"$POST\",\"reason\":\"SPAM\"}" >/dev/null
code=$(curl -s -b "$B" -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/posts/$POST/moderation" -H 'Content-Type: application/json' -d '{"action":"remove","reason":"x"}')
[ "$code" = 403 ] || fail "member could moderate ($code)"
code=$(curl -s -b "$B" -o /dev/null -w '%{http_code}' -X PUT "$BASE_URL/api/admin/flags" -H 'Content-Type: application/json' -d '{"key":"signups","enabled":false}')
[ "$code" = 403 ] || fail "member reached admin API ($code)"
code=$(curl -s -b "$B" -o /dev/null -w '%{http_code}' "$BASE_URL/admin")
[ "$code" = 404 ] || fail "member saw the control center ($code)"

step "pages render"
for path in /feed /explore /c /c/country "/p/$POST" "/t/$TONE" "/u/$HANDLE_A" /tones /gear /search?q=tweed; do
  code=$(curl -s -b "$B" -o /dev/null -w '%{http_code}' "$BASE_URL$path")
  [ "$code" = 200 ] || fail "GET $path returned $code"
done

step "delete both accounts"
api "$A" DELETE /api/me "{\"confirmHandle\":\"$HANDLE_A\",\"password\":\"$PASS_A\"}" >/dev/null
api "$B" DELETE /api/me "{\"confirmHandle\":\"$HANDLE_B\",\"password\":\"$PASS_B\"}" >/dev/null
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/posts/$POST")
[ "$code" = 404 ] || fail "deleted member's post still visible ($code)"

printf '\nPASS: platform end-to-end\n'
