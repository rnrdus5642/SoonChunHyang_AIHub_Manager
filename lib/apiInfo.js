// API 키의 잔여 크레딧 정보 조회
async function getCreditInfo(apiKey) {
  const url = "https://factchat-cloud.mindlogic.ai/v1/gateway/credits/";
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      remaining: data.total.remaining,
      quota: data.total.quota,
    };
  } catch (e) {
    console.error(`❌ 신용 정보 조회 실패: ${e.message}`);
    return null;
  }
}

module.exports = { getCreditInfo };
