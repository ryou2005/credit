import curriculum from "./src/data/kogakuin-2024.json" with { type: "json" };
import { getSupportedStudents, validateStudentInfo } from "./studentInfo.js";

const assessmentLabels = {
  graduation: "卒業",
  progression: "進級",
  "thesis-entry": "卒業論文着手",
};

/**
 * 単位数だけでなく、必修科目・選択必修・算入上限を含む要件を返す。
 * 戻り値は独立したコピー。selectedRulesのexpressionを計算担当へ渡す。
 */
export function getRequirements(student, assessment = "graduation") {
  const profile = validateStudentInfo(student);
  if (!Object.hasOwn(assessmentLabels, assessment)) {
    throw new Error(
      "判定種別は graduation・progression・thesis-entry から指定してください。",
    );
  }
  if (
    curriculum.releaseStatus !== "verified" ||
    curriculum.entryYear !== profile.entryYear ||
    curriculum.faculty !== profile.faculty ||
    curriculum.department !== profile.department
  ) {
    throw new Error("対応する確認済みの単位要件がありません。");
  }
  const rules = curriculum.rules.filter(
    (rule) => rule.assessment === assessment,
  );
  if (!rules.length) {
    throw new Error(`${assessmentLabels[assessment]}要件は未登録です。`);
  }
  // カリキュラム情報も保持し、既存の判定エンジンに渡せる形式にする。
  return structuredClone({ ...curriculum, assessment, selectedRules: rules });
}

export function getStudentLabel(student) {
  const profile = validateStudentInfo(student);
  const labels = getSupportedStudents().find(
    (candidate) =>
      candidate.entryYear === profile.entryYear &&
      candidate.faculty === profile.faculty &&
      candidate.department === profile.department,
  );
  return `${profile.entryYear}年度入学・${labels.facultyLabel}・${labels.departmentLabel}`;
}
