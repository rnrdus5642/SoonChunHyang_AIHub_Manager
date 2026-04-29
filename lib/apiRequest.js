const { chromium } = require("playwright");
const { FORM_URL, USER_TYPE_CHOICES } = require("../config");

// 폼이 보여야 하는 질문 순서 (구조 검증용)
const EXPECTED_QUESTIONS = [
  "성함",
  "소속(학과 및 부서)",
  "이용자 구분",
  "주 사용 LLM 모델",
  "진행하고 있는 작업에 대한 설명",
  "만족도 조사",
  "(선택) 건의 및 요구사항",
];

async function verifyFormStructure(page) {
  const items = page.locator('div[role="list"] > div[role="listitem"]');
  const count = await items.count();
  if (count !== EXPECTED_QUESTIONS.length) {
    throw new Error(
      `질문 개수 불일치: 예상 ${EXPECTED_QUESTIONS.length}개, 실제 ${count}개`
    );
  }
  for (let i = 0; i < EXPECTED_QUESTIONS.length; i++) {
    const heading = items.nth(i).locator('[role="heading"]').first();
    const text = (await heading.innerText()).replace(/\*/g, "").trim();
    if (!text.includes(EXPECTED_QUESTIONS[i])) {
      throw new Error(
        `질문 ${i + 1} 제목 불일치: 예상 '${EXPECTED_QUESTIONS[i]}', 실제 '${text}'`
      );
    }
  }
  console.log("✅ 폼 구조 검증 통과");
}

function validateFormData(formData) {
  const required = [
    "name",
    "affiliation",
    "userType",
    "llmModel",
    "workDescription",
    "satisfaction",
  ];
  const missing = required.filter(
    (k) => formData[k] === undefined || formData[k] === null || formData[k] === ""
  );
  if (missing.length) {
    throw new Error(`formData 누락 필드: ${missing.join(", ")}`);
  }
  if (!USER_TYPE_CHOICES.includes(formData.userType)) {
    throw new Error(
      `userType 값이 올바르지 않음: '${formData.userType}'\n가능한 값: ${USER_TYPE_CHOICES.join(", ")}`
    );
  }
  if (!["1", "2", "3", "4", "5"].includes(String(formData.satisfaction))) {
    throw new Error(`satisfaction 은 1~5 사이여야 함: ${formData.satisfaction}`);
  }
}

async function requestApiReplenishment(formData, { headless = true } = {}) {
  validateFormData(formData);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`🌐 폼 페이지 이동: ${FORM_URL}`);
    await page.goto(FORM_URL);
    await page.waitForSelector('div[role="list"] > div[role="listitem"]', {
      timeout: 15000,
    });

    // 1. 폼 구조 검증 — 다르면 디버그 모드로 전환
    try {
      await verifyFormStructure(page);
    } catch (e) {
      console.error(`❌ 폼 구조 변경 감지: ${e.message}`);
      console.error("🛠 디버그 모드: 30초간 브라우저를 열어둡니다.");
      await page.waitForTimeout(30000);
      return false;
    }

    const items = page.locator('div[role="list"] > div[role="listitem"]');

    const fillText = async (idx, value) => {
      const input = items.nth(idx).locator('input[type="text"], textarea').first();
      await input.click();
      await input.fill(value);
    };

    const selectRadio = async (idx, value) => {
      const radio = items.nth(idx).locator(`[role="radio"][data-value="${value}"]`);
      if ((await radio.count()) === 0) {
        throw new Error(`라디오 옵션 '${value}' 을(를) 질문 ${idx + 1} 에서 찾을 수 없음`);
      }
      await radio.click();
    };

    // 2. 입력
    console.log("✍ 폼 작성 중...");
    await fillText(0, formData.name);
    await fillText(1, formData.affiliation);
    await selectRadio(2, formData.userType);
    await fillText(3, formData.llmModel);
    await fillText(4, formData.workDescription);
    await selectRadio(5, String(formData.satisfaction));
    if (formData.suggestions) {
      await fillText(6, formData.suggestions);
    }

    console.log("✅ 폼 작성 완료");

    // 3. 제출
    const submitBtn = page.locator('div[role="button"][aria-label="Submit"]');
    await submitBtn.click();
    await page.waitForLoadState("networkidle");
    console.log("📨 제출 완료");

    return true;
  } catch (e) {
    console.error(`❌ 보충 요청 중 오류: ${e.message}`);
    return false;
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = { requestApiReplenishment };
