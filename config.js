// 정적 설정 (수정될 일이 거의 없음)
// 동적 데이터(계정/임계값)는 data.json 에 저장됨

const FORM_URL = "https://forms.gle/kKwk4bUxvPRJCH8t5";

const USER_TYPE_CHOICES = [
  "교원(비전임교원,기타교원 포함)",
  "강사",
  "교직원",
  "조교",
  "재학생(학부생, 대학원생)",
];

const PORT = 8080;

module.exports = { FORM_URL, USER_TYPE_CHOICES, PORT };
