# TurnPM — 제품개발/생산 턴키 프로젝트 협업 플랫폼

클라이언트별 프로젝트 일정·업무·자료·코멘트를 한곳에서 관리하는 웹 플랫폼입니다. Next.js + Firebase(Firestore/Auth/Storage/Functions)로 구현되어 있습니다.

## 주요 기능

- **간트 차트**: 업무 시작일/마감일, 선후행 관계(화살표), 오늘 표시선, 지연 업무 강조
- **업무 리스트**: 담당자/마감일/진행률/상태를 한 화면에서 관리, 상태별 색상 배지
- **업무 상세**: 자료 업로드(Firebase Storage), 이메일 없이 코멘트 작성
- **담당자/마감일 관리**: 업무별 담당자 지정, 지연·임박 업무 자동 표시
- **대시보드**: 진행률, 상태 분포, 상태별 평균 체류 기간(병목 구간) 차트
- **워크플로우 자동화**: 업무 템플릿 일괄 생성, 선행 업무 완료 시 자동 잠금 해제, 상태변경/코멘트/마감임박 자동 알림

## 기술 스택

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Firebase Authentication (이메일/비밀번호)
- Cloud Firestore (데이터베이스)
- Firebase Storage (첨부파일)
- Cloud Functions v2 (계정 생성, 자동화 트리거, 일일 알림 스케줄러)
- 호스팅: **Vercel 권장** (Next.js 동적 라우트(`/projects/[projectId]` 등)는 Firebase Hosting 정적 export와 호환되지 않습니다. Firestore/Auth/Storage/Functions는 그대로 Firebase를 사용합니다.)

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 에서 새 프로젝트를 생성합니다.
2. **Authentication** → 시작하기 → 로그인 방법에서 **이메일/비밀번호** 활성화
3. **Firestore Database** → 데이터베이스 만들기 (프로덕션 모드, 리전은 `asia-northeast3`(서울) 권장)
4. **Storage** → 시작하기 (Firestore와 동일 리전 권장)
5. **Functions**를 쓰려면 결제 플랜을 **Blaze(종량제)**로 업그레이드해야 합니다 (매일 알림 스케줄러 포함, 일반 사용량은 무료 한도 내에서 거의 비용이 발생하지 않습니다).
6. 프로젝트 설정 → 일반 → "내 앱" → 웹 앱(`</>`) 추가 → 표시되는 `firebaseConfig` 값을 복사해둡니다.

## 2. 로컬 환경 설정

```bash
cd pm-platform
cp .env.local.example .env.local
```

`.env.local`에 1-6에서 복사한 값을 채워넣습니다.

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속 → 로그인 페이지로 이동합니다(아직 계정이 없으므로 3단계 먼저 진행).

> 이 코드는 네트워크가 제한된 환경에서 패키지 설치 없이 작성되었습니다. 실제 환경에서 `npm install` 후 `npm run build`로 타입/빌드 오류가 없는지 한 번 확인해주세요.

## 3. 최초 관리자(형준님) 계정 만들기

Cloud Functions 배포 전에는 관리자 계정이 하나도 없으므로 수동으로 만들어야 합니다.

1. Firebase 콘솔 → Authentication → 사용자 추가 → 이메일/비밀번호 입력 (예: `kinkin10120@gmail.com`)
2. 생성된 사용자의 **UID**를 복사
3. Firestore Database → `users` 컬렉션 → 문서 추가 → **문서 ID에 위 UID를 그대로 입력**, 아래 필드 입력:
   - `email` (string): 로그인 이메일
   - `name` (string): 표시 이름 (예: `형준`)
   - `role` (string): `admin`
   - `createdAt` (timestamp): 현재 시간
4. 앱에 다시 로그인하면 관리자 화면(클라이언트 관리, 템플릿 메뉴)이 보입니다.

이후 클라이언트 계정은 관리자가 **클라이언트 상세 페이지 → "계정 추가"**에서 만들 수 있습니다(이메일 발송 없이 임시 비밀번호를 직접 전달).

## 4. Firestore 보안 규칙 / 인덱스 / Storage 규칙 배포

```bash
npm install -g firebase-tools   # 최초 1회
firebase login
firebase use --add             # 1단계에서 만든 프로젝트 선택
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 5. Cloud Functions 배포

`functions/src/index.ts`에 아래 기능이 구현되어 있습니다.

- `createClientAccount`: 관리자가 클라이언트 로그인 계정을 생성하는 callable 함수
- `onTaskStatusChange`: 업무가 완료되면 선행 업무가 모두 끝난 후속 업무를 자동으로 잠금 해제
- `onCommentCreated`: 코멘트 작성 시 상대방(담당자)에게 알림 생성
- `dueSoonReminder`: 매일 오전 9시(KST), 마감 임박(오늘/내일) 업무 담당자에게 알림 생성 — **Blaze 플랜 필요**

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## 6. 프론트엔드 배포 (Vercel)

1. https://vercel.com 에서 GitHub 리포지토리(또는 이 폴더)를 import
2. Root Directory를 `pm-platform`으로 지정
3. 환경 변수에 `.env.local`과 동일한 `NEXT_PUBLIC_FIREBASE_*` 값들을 등록
4. Deploy

## 폴더 구조 요약

```
pm-platform/
  src/app/                    # 라우트 (로그인, /home, /clients, /projects/[id], /templates)
  src/components/             # Gantt, TaskList, 업무 상세 Drawer, 대시보드 차트 등
  src/lib/firestore/          # Firestore 읽기/쓰기 함수 (clients, projects, tasks, comments, files, templates, users, notifications)
  src/lib/bottleneck.ts       # 병목 구간/지연/진행률 계산 로직
  functions/src/index.ts      # Cloud Functions (계정 생성, 자동화 트리거, 알림 스케줄러)
  firestore.rules / storage.rules / firestore.indexes.json
```

## 권한 모델

- **admin**: 형준님 측 운영팀. 클라이언트/프로젝트/업무 생성·수정, 템플릿 관리, 모든 데이터 조회
- **client**: 외부 클라이언트 담당자. 본인 회사(`clientId`)에 속한 프로젝트·업무만 조회, 업무 상태 변경·코멘트·자료 업로드 가능, 업무 생성/삭제나 마감일·담당자 변경은 admin만 가능

## 알려진 제한 사항

- 이 코드는 네트워크가 차단된 샌드박스에서 작성되어 `npm run build`/타입체크를 실행해보지 못했습니다. 로컬에서 설치 후 한 번 빌드 확인을 권장합니다.
- `dueSoonReminder` 스케줄러는 Firebase Blaze 플랜과 Cloud Scheduler API 활성화가 필요합니다.
- 대용량 첨부파일이나 동시 다중 클라이언트 환경에서의 부하 테스트는 진행하지 않았습니다.
