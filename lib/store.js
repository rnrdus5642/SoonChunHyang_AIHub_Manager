const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..");
const DATA_FILE = path.join(DATA_DIR, "data.json");

const DEFAULT_DATA = {
  thresholds: { balance: 4000, quota: 30000 },
  accounts: [],
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), "utf-8");
    console.log(`📝 data.json 이 없어 기본값으로 생성했습니다: ${DATA_FILE}`);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function getAccounts() {
  return loadData().accounts;
}

function getThresholds() {
  return loadData().thresholds;
}

function setThresholds(thresholds) {
  const data = loadData();
  data.thresholds = { ...data.thresholds, ...thresholds };
  saveData(data);
  return data.thresholds;
}

function addAccount(account) {
  const data = loadData();
  data.accounts.push(account);
  saveData(data);
  return data.accounts.length - 1;
}

function updateAccount(idx, account) {
  const data = loadData();
  if (idx < 0 || idx >= data.accounts.length) return null;
  data.accounts[idx] = account;
  saveData(data);
  return data.accounts[idx];
}

function deleteAccount(idx) {
  const data = loadData();
  if (idx < 0 || idx >= data.accounts.length) return false;
  data.accounts.splice(idx, 1);
  saveData(data);
  return true;
}

function setLastRequested(idx, timestamp) {
  const data = loadData();
  if (idx < 0 || idx >= data.accounts.length) return null;
  data.accounts[idx].lastRequestedAt = timestamp;
  saveData(data);
  return timestamp;
}

module.exports = {
  loadData,
  saveData,
  getAccounts,
  getThresholds,
  setThresholds,
  addAccount,
  updateAccount,
  deleteAccount,
  setLastRequested,
};
