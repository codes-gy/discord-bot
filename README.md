# 🍮 젤리봇 (jelly-bot)

유튜브 음악 재생, TTS 채널 읽어주기, 그리고 몇 가지 서버 유틸리티를 처리하는 디스코드 봇입니다.
`discord.js` v14 + `@discordjs/voice` 기반의 TypeScript 프로젝트입니다.

---

## ✨ 주요 기능

### 🎵 음악 재생
- 유튜브 URL 또는 검색어로 음악 재생, 서버별 독립 대기열
- 검색어 입력 시 상위 5개 결과 중 직접 선택 가능
- 일시정지/재개, 스킵, 반복(한 곡/전체), 셔플, 볼륨 조절
- Now Playing 메시지에 버튼(⏯ ⏭ ⏹ 🔁)이 붙어 있어 명령어 없이도 조작 가능
- 대기열이 비면 3분 후, 음성 채널에 혼자 남으면 1분 후 자동 퇴장

### 🗣 TTS (Text-to-Speech)
- 지정한 텍스트 채널에 올라오는 메시지를 음성 채널에서 자동으로 읽어줌
- 음악 재생 중에는 우선순위 인터럽트 방식으로 일시정지 후 TTS 재생, 종료 후 음악 재개
- 사용자별 TTS 언어 설정 가능 (한국어/영어/일본어/중국어)

### 🛠 서버 유틸리티
- 신규 멤버 입장 시 지정 채널에 환영 메시지 자동 전송
- `/통계`로 서버의 오늘/누적 음악 재생 횟수와 최다 재생곡 TOP 5 확인

---

## 📜 슬래시 커맨드 목록

| 명령어 | 설명 |
| :--- | :--- |
| `/재생 <검색어\|URL>` | 유튜브 URL 또는 검색어로 음악 재생/대기열 추가 |
| `/일시정지` | 현재 재생 중인 곡을 대기열은 그대로 둔 채 일시정지 |
| `/재개` | 일시정지된 음악을 다시 이어서 재생 |
| `/스킵` | 현재 곡을 건너뛰고 다음 곡 재생 |
| `/정지` | 음악 재생 중단 및 대기열 전체 초기화 |
| `/재생목록` | 현재 재생 중인 곡과 대기열 조회 |
| `/반복 <끄기\|한 곡 반복\|전체 반복>` | 반복 재생 모드 설정 |
| `/셔플` | 대기열 순서를 무작위로 섞기 |
| `/볼륨 <0~100>` | 재생 볼륨 설정 |
| `/퇴장` | 음성 채널에서 나가고 상태 초기화 |
| `/채널등록` | 현재 텍스트 채널을 TTS 자동 읽기 채널로 지정 (관리자 전용) |
| `/채널해제` | 등록된 TTS 채널 해제 (관리자 전용) |
| `/tts설정 <언어>` | 내 메시지를 읽어줄 TTS 언어 설정 |
| `/환영채널등록 [채널]` | 신규 멤버 환영 메시지를 보낼 채널 지정 (관리자 전용) |
| `/환영채널해제` | 등록된 환영 채널 해제 (관리자 전용) |
| `/통계` | 서버의 음악 재생 통계 조회 |

---

## 🧰 기술 스택

- **Runtime**: Node.js 24
- **Language**: TypeScript
- **Discord**: `discord.js` v14, `@discordjs/voice`, `@discordjs/opus`
- **음악 스트리밍**: `play-dl` (1차), `youtube-dl-exec` + `prism-media`(FFmpeg) 폴백
- **TTS**: `google-tts-api`
- **저장소**: Redis (TTS/환영 채널 등록, 사용자별 TTS 언어, 재생 통계 — 대기열/플레이어 상태는 프로세스 메모리)
- **빌드**: `esbuild`
- **배포**: Render (GitHub Actions로 PR마다 Deploy Hook 트리거)

---

## 🚀 로컬 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. Redis 실행 (Docker)
```bash
docker compose up -d
```
`discord-bot-redis` 컨테이너가 `localhost:6379`에서 뜹니다. Redis 내부 데이터를 GUI로 보고 싶다면 `redis-insight`가 `localhost:5540`에서 함께 실행됩니다.

### 3. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 만들고 아래 값을 채워주세요.

| 변수명 | 필수 여부 | 설명 |
| :--- | :--- | :--- |
| `DISCORD_TOKEN` | 필수 | [Discord 개발자 포털](https://discord.com/developers/applications)에서 발급받은 봇 토큰 |
| `APPLICATION_ID` | 필수 | 애플리케이션(클라이언트) ID |
| `REDIS_URL` | 필수 | Redis 연결 문자열 (로컬 기본값: `redis://localhost:6379`) |
| `YOUTUBE_COOKIE` | 선택 | 유튜브 쿠키 원문 (429/봇 감지 우회용) |
| `YOUTUBE_COOKIES_BASE64` | 선택 | 유튜브 쿠키를 base64로 인코딩한 값 (배포 환경에서 `cookies.txt`로 복원됨). 설정 시 `YOUTUBE_COOKIE`보다 우선 적용 |
| `PORT` | 선택 | 헬스체크용 HTTP 서버 포트 (기본값: `10000`) |

### 4. 슬래시 커맨드 배포
디스코드에 슬래시 커맨드를 글로벌로 등록합니다 (최대 1시간 정도 반영에 걸릴 수 있음).
```bash
npm run deploy
```

### 5. 개발 서버 실행
```bash
npm run dev
```
`src/**/*.ts` 변경을 감지해 자동으로 재시작합니다 (`nodemon` + `tsx`).

---

## 📦 빌드 및 실행

```bash
npm run build   # esbuild로 dist/app.js 번들 생성
npm start       # 번들된 dist/app.js 실행
```

---

## ☁️ 배포

[Render](https://render.com)의 Web Service로 배포합니다. `main`/`develop` 브랜치로 PR이 열리거나 갱신되면 `.github/workflows/deploy.yaml`이 다음을 수행합니다.

1. 의존성 설치(`npm ci`) 및 빌드 검증(`npm run build`)
2. Render Deploy Hook 호출로 배포 트리거
3. PR에 배포 요청 결과 댓글 작성

Render 배포 환경에는 위 환경 변수들과 `RENDER_DEPLOY_HOOK_URL`(GitHub Actions 시크릿)이 설정되어 있어야 합니다. Render는 무료 플랜 기준 15분간 요청이 없으면 슬립 상태로 전환되니, 봇을 상시 온라인으로 유지하려면 유료 플랜 또는 외부 핑 서비스가 필요합니다.

> ⚠️ 서버리스 플랫폼(Vercel 등)에는 배포할 수 없습니다. 디스코드 음성 봇은 게이트웨이에 상시 접속된 WebSocket과 UDP 기반 음성 연결이 필요한데, 서버리스 함수는 이를 지원하지 않습니다.

---

## 📁 프로젝트 구조

```
src/
├── app.ts                  # 진입점: 이벤트 리스너 연결, 헬스체크 서버, 부트스트랩
├── deploy-commands.ts       # 슬래시 커맨드를 디스코드에 등록하는 스크립트
├── commands/
│   ├── music/               # 음악 관련 슬래시 커맨드
│   ├── tts/                  # TTS 관련 슬래시 커맨드
│   └── utility/              # 환영 메시지/통계 등 서버 유틸리티 커맨드
├── events/                  # discord.js 이벤트 핸들러
├── services/audio/           # 음악/TTS 재생 오케스트레이션, 유튜브 스트림, 자동 퇴장 등
├── libs/                    # Discord 클라이언트, 환경 변수, Redis 클라이언트
├── utils/                    # 임베드 빌더, 에러 핸들링, 포맷팅 등 공용 유틸
└── types/                   # 공용 타입 정의
```

---

## 🗺 향후 계획

기능 확장 계획 및 의사결정 기록은 [`discord-bot-v2-plan.md`](./discord-bot-v2-plan.md)를 참고해주세요.
