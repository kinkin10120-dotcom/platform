#!/bin/bash
set -e

echo "배포 중..."
OUTPUT=$(npx vercel --prod 2>&1)
echo "$OUTPUT"

DEPLOYMENT=$(echo "$OUTPUT" | grep -o 'pm-platform-[a-z0-9]*-handyhand\.vercel\.app' | tail -1)

if [ -z "$DEPLOYMENT" ]; then
  echo "배포 URL을 찾지 못했습니다."
  exit 1
fi

echo ""
echo "handyhand.co.kr → $DEPLOYMENT 연결 중..."
npx vercel alias set "$DEPLOYMENT" handyhand.co.kr
echo "완료!"
