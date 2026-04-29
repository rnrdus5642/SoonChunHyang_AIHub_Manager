const tbody = document.getElementById("tbody");
const refreshBtn = document.getElementById("refresh-btn");
const settingsBtn = document.getElementById("settings-btn");
const addBtn = document.getElementById("add-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsForm = document.getElementById("settings-form");
const accountModal = document.getElementById("account-modal");
const accountForm = document.getElementById("account-form");
const accountModalTitle = document.getElementById("account-modal-title");
const userTypeSelect = document.getElementById("userType-select");
const toast = document.getElementById("toast");

let userTypeChoices = [];
let editingIdx = null; // null = 새 계정, number = 수정

/* ============== Utils ============== */
function showToast(message, type = "") {
  toast.textContent = message;
  toast.className = "toast show " + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

async function api(path, options = {}) {
  const opts = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ============== Render ============== */
function renderRow(a) {
  const tr = document.createElement("tr");
  tr.dataset.idx = a.idx;

  if (a.remaining === null) {
    tr.innerHTML = `
      <td class="idx">${a.idx + 1}</td>
      <td class="name">${escapeHtml(a.name)}</td>
      <td colspan="3" class="error">조회 실패</td>
      <td class="date">${formatDate(a.lastRequestedAt)}</td>
      <td class="actions-col">
        <div class="row-actions">
          <button class="btn btn-sm btn-ghost" data-act="refresh">새로고침</button>
          <button class="btn btn-sm btn-ghost" data-act="edit">수정</button>
          <button class="btn btn-sm btn-danger" data-act="delete">삭제</button>
        </div>
      </td>
    `;
    return tr;
  }

  const balanceCls = a.lowBalance ? "low" : "";
  const statusBadges = [];
  if (a.lowBalance) {
    statusBadges.push(`<span class="badge badge-danger">잔액 부족</span>`);
  } else {
    statusBadges.push(`<span class="badge badge-success">잔액 충분</span>`);
  }
  if (a.requestable) {
    statusBadges.push(`<span class="badge badge-warning">요청 가능</span>`);
  } else {
    statusBadges.push(`<span class="badge badge-muted">요청 불가</span>`);
  }

  tr.innerHTML = `
    <td class="idx">${a.idx + 1}</td>
    <td class="name">${escapeHtml(a.name)}</td>
    <td class="num ${balanceCls}">${Math.floor(a.remaining).toLocaleString()}</td>
    <td class="num">${Math.floor(a.quota).toLocaleString()}</td>
    <td><div class="status-cell">${statusBadges.join("")}</div></td>
    <td class="date">${formatDate(a.lastRequestedAt)}</td>
    <td class="actions-col">
      <div class="row-actions">
        <button class="btn btn-sm btn-ghost" data-act="refresh">새로고침</button>
        <button class="btn btn-sm btn-secondary" data-act="replenish" ${a.requestable ? "" : "disabled"}>보충 요청</button>
        <button class="btn btn-sm btn-ghost" data-act="edit">수정</button>
        <button class="btn btn-sm btn-danger" data-act="delete">삭제</button>
      </div>
    </td>
  `;
  return tr;
}

function renderStats(accounts) {
  const total = accounts.length;
  const low = accounts.filter((a) => a.lowBalance === true).length;
  const requestable = accounts.filter((a) => a.requestable === true).length;
  const errored = accounts.filter((a) => a.remaining === null).length;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-low").textContent = low;
  document.getElementById("stat-requestable").textContent = requestable;
  document.getElementById("stat-normal").textContent = total - low - errored;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ============== Data Loaders ============== */
async function loadAll() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "⏳ 조회 중...";
  try {
    const data = await api("/api/credits");
    tbody.innerHTML = "";
    data.accounts.forEach((a) => tbody.appendChild(renderRow(a)));
    renderStats(data.accounts);
  } catch (e) {
    showToast(`오류: ${e.message}`, "error");
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "🔄 전체 새로고침";
  }
}

async function refreshOne(idx, { silent = false } = {}) {
  const tr = tbody.querySelector(`tr[data-idx="${idx}"]`);
  if (tr) tr.style.opacity = "0.5";
  try {
    const a = await api(`/api/credits/${idx}`);
    if (tr) {
      const newRow = renderRow(a);
      tr.replaceWith(newRow);
    }
    // 통계 갱신
    const allTrs = [...tbody.querySelectorAll("tr")];
    const accounts = allTrs.map((row) => ({
      idx: parseInt(row.dataset.idx, 10),
      remaining: row.querySelector(".num") ? 1 : null,
      lowBalance: !!row.querySelector(".badge-danger"),
      requestable: !!row.querySelector(".badge-warning"),
    }));
    renderStats(accounts);
    if (!silent) showToast(`${a.name} 새로고침 완료`, "success");
  } catch (e) {
    showToast(`오류: ${e.message}`, "error");
    if (tr) tr.style.opacity = "1";
  }
}

async function replenish(idx, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "요청 중...";
  showToast("브라우저 창을 확인하세요", "");
  try {
    const r = await api(`/api/replenish/${idx}`, { method: "POST" });
    if (r.success) {
      await refreshOne(idx, { silent: true });
    }
    showToast(
      r.success ? `${r.name} 보충 요청 제출 완료` : `${r.name} 실패`,
      r.success ? "success" : "error"
    );
  } catch (e) {
    showToast(`오류: ${e.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function deleteAccount(idx) {
  const tr = tbody.querySelector(`tr[data-idx="${idx}"]`);
  const name = tr ? tr.querySelector(".name").textContent : `#${idx + 1}`;
  if (!confirm(`"${name}" 계정을 삭제하시겠습니까?`)) return;
  try {
    await api(`/api/accounts/${idx}`, { method: "DELETE" });
    showToast(`${name} 삭제됨`, "success");
    loadAll();
  } catch (e) {
    showToast(`오류: ${e.message}`, "error");
  }
}

/* ============== Settings Modal ============== */
async function openSettings() {
  const settings = await api("/api/settings");
  settingsForm.balance.value = settings.balance;
  settingsForm.quota.value = settings.quota;
  settingsModal.showModal();
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const balance = parseInt(settingsForm.balance.value, 10);
  const quota = parseInt(settingsForm.quota.value, 10);
  try {
    await api("/api/settings", {
      method: "PUT",
      body: { balance, quota },
    });
    settingsModal.close();
    showToast("임계값 저장됨", "success");
    loadAll();
  } catch (err) {
    showToast(`오류: ${err.message}`, "error");
  }
});

/* ============== Account Modal ============== */
function fillUserTypeSelect() {
  userTypeSelect.innerHTML = "";
  userTypeChoices.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    userTypeSelect.appendChild(opt);
  });
}

function openAccountModal(idx = null) {
  editingIdx = idx;
  accountForm.reset();
  if (idx === null) {
    accountModalTitle.textContent = "＋ 계정 추가";
    userTypeSelect.value = userTypeChoices[userTypeChoices.length - 1];
    accountForm.satisfaction.value = 5;
    accountModal.showModal();
  } else {
    accountModalTitle.textContent = "✏ 계정 수정";
    api(`/api/accounts/${idx}`).then((acc) => {
      accountForm.name.value = acc.name || "";
      accountForm.apiKey.value = acc.apiKey || "";
      const fd = acc.formData || {};
      accountForm.formName.value = fd.name || "";
      accountForm.affiliation.value = fd.affiliation || "";
      userTypeSelect.value = fd.userType || userTypeChoices[userTypeChoices.length - 1];
      accountForm.llmModel.value = fd.llmModel || "";
      accountForm.workDescription.value = fd.workDescription || "";
      accountForm.satisfaction.value = fd.satisfaction || 5;
      accountForm.suggestions.value = fd.suggestions || "";
      accountModal.showModal();
    });
  }
}

accountForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const account = {
    name: accountForm.name.value.trim(),
    apiKey: accountForm.apiKey.value.trim(),
    formData: {
      name: accountForm.formName.value.trim() || accountForm.name.value.trim(),
      affiliation: accountForm.affiliation.value.trim(),
      userType: userTypeSelect.value,
      llmModel: accountForm.llmModel.value.trim(),
      workDescription: accountForm.workDescription.value.trim(),
      satisfaction: parseInt(accountForm.satisfaction.value, 10),
      suggestions: accountForm.suggestions.value.trim(),
    },
  };
  try {
    if (editingIdx === null) {
      await api("/api/accounts", { method: "POST", body: account });
      showToast("계정 추가됨", "success");
    } else {
      await api(`/api/accounts/${editingIdx}`, { method: "PUT", body: account });
      showToast("계정 수정됨", "success");
    }
    accountModal.close();
    loadAll();
  } catch (err) {
    showToast(`오류: ${err.message}`, "error");
  }
});

/* ============== Modal close ============== */
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest("dialog").close());
});

/* ============== Event delegation ============== */
tbody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const idx = parseInt(tr.dataset.idx, 10);
  const act = btn.dataset.act;
  switch (act) {
    case "refresh": refreshOne(idx); break;
    case "replenish": replenish(idx, btn); break;
    case "edit": openAccountModal(idx); break;
    case "delete": deleteAccount(idx); break;
  }
});

refreshBtn.addEventListener("click", loadAll);
settingsBtn.addEventListener("click", openSettings);
addBtn.addEventListener("click", () => openAccountModal(null));

/* ============== Init ============== */
(async () => {
  try {
    const meta = await api("/api/meta");
    userTypeChoices = meta.userTypeChoices;
    fillUserTypeSelect();
  } catch (e) {
    showToast("초기화 실패: " + e.message, "error");
  }
  loadAll();
})();
