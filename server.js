const express = require("express");
const path = require("path");

const { getCreditInfo } = require("./lib/apiInfo");
const { requestApiReplenishment } = require("./lib/apiRequest");
const store = require("./lib/store");
const { USER_TYPE_CHOICES, FORM_URL, PORT } = require("./config");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function annotateAccount(idx, acc, info, thresholds) {
  const base = {
    idx,
    name: acc.name,
    lastRequestedAt: acc.lastRequestedAt || null,
  };
  if (!info) {
    return {
      ...base,
      remaining: null,
      quota: null,
      lowBalance: null,
      requestable: null,
    };
  }
  return {
    ...base,
    remaining: info.remaining,
    quota: info.quota,
    lowBalance: info.remaining < thresholds.balance,
    requestable: info.quota < thresholds.quota,
  };
}

// 메타 정보 (UI용)
app.get("/api/meta", (req, res) => {
  res.json({ userTypeChoices: USER_TYPE_CHOICES, formUrl: FORM_URL });
});

// 임계값 조회/수정
app.get("/api/settings", (req, res) => {
  res.json(store.getThresholds());
});

app.put("/api/settings", (req, res) => {
  const { balance, quota } = req.body;
  const update = {};
  if (Number.isFinite(balance)) update.balance = balance;
  if (Number.isFinite(quota)) update.quota = quota;
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "balance 또는 quota 가 필요" });
  }
  res.json(store.setThresholds(update));
});

// 모든 계정의 크레딧 일괄 조회
app.get("/api/credits", async (req, res) => {
  const accounts = store.getAccounts();
  const thresholds = store.getThresholds();
  const results = await Promise.all(
    accounts.map(async (acc, i) => {
      const info = await getCreditInfo(acc.apiKey);
      return annotateAccount(i, acc, info, thresholds);
    })
  );
  res.json({ accounts: results, thresholds });
});

// 단일 계정 새로고침
app.get("/api/credits/:idx", async (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const accounts = store.getAccounts();
  const account = accounts[idx];
  if (!account) return res.status(404).json({ error: "계정을 찾을 수 없음" });
  const info = await getCreditInfo(account.apiKey);
  res.json(annotateAccount(idx, account, info, store.getThresholds()));
});

// 계정 목록 (편집용 — formData 포함)
app.get("/api/accounts", (req, res) => {
  res.json(store.getAccounts());
});

app.get("/api/accounts/:idx", (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const account = store.getAccounts()[idx];
  if (!account) return res.status(404).json({ error: "계정을 찾을 수 없음" });
  res.json(account);
});

// 계정 추가
app.post("/api/accounts", (req, res) => {
  const account = req.body;
  if (!account || !account.name || !account.apiKey) {
    return res.status(400).json({ error: "name, apiKey 필요" });
  }
  if (!account.formData) {
    account.formData = {
      name: account.name,
      affiliation: "",
      userType: USER_TYPE_CHOICES[USER_TYPE_CHOICES.length - 1],
      llmModel: "",
      workDescription: "",
      satisfaction: 5,
      suggestions: "",
    };
  }
  const idx = store.addAccount(account);
  res.json({ idx, account });
});

// 계정 수정
app.put("/api/accounts/:idx", (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const updated = store.updateAccount(idx, req.body);
  if (!updated) return res.status(404).json({ error: "계정을 찾을 수 없음" });
  res.json(updated);
});

// 계정 삭제
app.delete("/api/accounts/:idx", (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const ok = store.deleteAccount(idx);
  if (!ok) return res.status(404).json({ error: "계정을 찾을 수 없음" });
  res.json({ success: true });
});

// 보충 요청 (브라우저 자동화)
app.post("/api/replenish/:idx", async (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  const account = store.getAccounts()[idx];
  if (!account) return res.status(404).json({ error: "계정을 찾을 수 없음" });
  if (!account.formData) return res.status(400).json({ error: "formData 누락" });

  console.log(`\n[${idx + 1}] ${account.name} 보충 요청 시작`);
  try {
    const success = await requestApiReplenishment(account.formData);
    let lastRequestedAt = account.lastRequestedAt || null;
    if (success) {
      lastRequestedAt = new Date().toISOString();
      store.setLastRequested(idx, lastRequestedAt);
    }
    res.json({ success, name: account.name, lastRequestedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
