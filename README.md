# School API Auto

SCH AI-Hub 크레딧 모니터 + 보충 요청 자동화 대시보드.

여러 API 키의 잔액/할당량을 한 곳에서 확인하고, 부족한 계정에 대해 Google Forms 보충 요청을 자동으로 제출합니다.

---

## 주요 기능

- 🔍 **크레딧 일괄/개별 조회** — 등록된 모든 계정의 잔액·할당량 표시
- 📊 **상태 대시보드** — 잔액 부족 / 요청 가능 / 정상 통계 카드
- 🤖 **보충 요청 자동화** — Playwright(Chromium headless)로 Google Forms 자동 작성·제출
- 🛠 **계정 CRUD** — 웹 UI에서 계정 추가·수정·삭제
- ⚙ **임계값 설정** — 잔액/할당량 임계값을 웹에서 즉시 변경
- 📅 **최근 요청 기록** — 보충 요청 시점이 자동 저장·표시
- 🔁 **폼 구조 변경 감지** — 폼 질문 순서/제목이 바뀌면 제출하지 않고 에러 반환

---

## 기술 스택

- **Backend**: Node.js + Express
- **Browser Automation**: Playwright (Chromium)
- **Frontend**: Vanilla HTML/CSS/JS (의존성 0)
- **Storage**: JSON 파일 (`data.json`)

---

## 프로젝트 구조

```
SchoolAPIAuto/
├── package.json
├── config.js              # 정적 설정 (FORM_URL, USER_TYPE_CHOICES, PORT)
├── server.js              # Express 서버 + API 라우트
├── data.json              # 계정/임계값 (gitignored, 자동 생성)
├── lib/
│   ├── store.js           # data.json 로딩/저장
│   ├── apiInfo.js         # 크레딧 조회 (fetch)
│   └── apiRequest.js      # Google Forms 자동화 (Playwright)
└── public/
    ├── index.html         # 대시보드 UI
    ├── style.css
    └── app.js
```

---

## 설치 및 실행

### 1. 클론

```bash
git clone <repo-url>
cd SchoolAPIAuto
```

### 2. 의존성 설치

```bash
npm install
npx playwright install chromium
```

### 3. 서버 시작

```bash
npm start
```

처음 실행 시 `data.json`이 빈 계정 목록과 기본 임계값으로 자동 생성됩니다.

### 4. 접속

`http://localhost:8080`

웹 UI에서 **＋ 계정 추가** 버튼으로 계정을 등록하세요.

---

## 설정

### 정적 설정 — `config.js`

| 항목 | 설명 |
| --- | --- |
| `FORM_URL` | 보충 요청 Google Form URL |
| `USER_TYPE_CHOICES` | 폼의 "이용자 구분" 라디오 옵션 (변경 시 형식 일치 필요) |
| `PORT` | Express 서버 포트 (기본 `8080`) |

### 동적 데이터 — `data.json`

```json
{
  "thresholds": { "balance": 4000, "quota": 30000 },
  "accounts": [
    {
      "name": "홍길동",
      "apiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "formData": {
        "name": "홍길동",
        "affiliation": "디지털애니메이션과",
        "userType": "재학생(학부생, 대학원생)",
        "llmModel": "GPT-4, Claude",
        "workDescription": "프로젝트 자료 조사 및 분석",
        "satisfaction": 5,
        "suggestions": ""
      },
      "lastRequestedAt": "2026-04-29T05:30:00.000Z"
    }
  ]
}
```

웹 UI를 통해 편집하면 자동으로 저장됩니다. 직접 수정해도 됩니다 (서버 재시작 불필요).

---

## REST API

| Method | 엔드포인트 | 설명 |
| --- | --- | --- |
| GET | `/api/meta` | userType 선택지, FORM_URL |
| GET | `/api/settings` | 임계값 조회 |
| PUT | `/api/settings` | 임계값 수정 (`{ balance, quota }`) |
| GET | `/api/credits` | 모든 계정 크레딧 일괄 조회 |
| GET | `/api/credits/:idx` | 단일 계정 새로고침 |
| GET | `/api/accounts` | 계정 목록 (formData 포함) |
| GET | `/api/accounts/:idx` | 단일 계정 상세 |
| POST | `/api/accounts` | 계정 추가 |
| PUT | `/api/accounts/:idx` | 계정 수정 |
| DELETE | `/api/accounts/:idx` | 계정 삭제 |
| POST | `/api/replenish/:idx` | 보충 요청 제출 (Playwright) |

---

## 폼 구조 검증

`lib/apiRequest.js`에 `EXPECTED_QUESTIONS` 배열이 정의돼 있습니다. 페이지 로딩 후 실제 질문 개수와 제목이 이 배열과 일치하지 않으면 제출하지 않고 에러를 반환합니다 — 폼이 변경됐을 때 잘못된 데이터가 제출되지 않도록 막는 안전장치입니다.

폼이 변경된 경우 `EXPECTED_QUESTIONS`와 입력 순서를 함께 업데이트해야 합니다.

---

## 홈서버 배포 (Tailscale)

1. 홈서버에서 클론 → `npm install && npx playwright install chromium`
2. `npm start`
3. Tailscale IP/MagicDNS 호스트네임으로 접속: `http://<host>:8080`
4. 방화벽에서 8080 인바운드 허용

`data.json`은 gitignore되어 있어 API 키가 외부에 노출되지 않습니다. 홈서버에는 별도로 등록해야 합니다.

---

## 주의 사항

- `data.json`에는 API 키가 평문으로 저장됩니다 — **반드시 gitignore 유지**
- 보충 요청은 실제로 제출되므로 테스트 시 주의
- Google Forms는 구조가 변경될 수 있으므로 가끔 폼 검증 로직을 점검할 것
