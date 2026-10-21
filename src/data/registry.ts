import raw from "./kogakuin-2024.json";
import rawMaster from "./course-master.json";
import { validateCurriculum } from "../domain/validate";
import { validateCourseMaster } from "../domain/master";
export { validateCurriculum } from "../domain/validate";
export const official = validateCurriculum(raw);
export const courseMaster = validateCourseMaster(rawMaster);
export const registry = [official].filter(
  (c) => c.releaseStatus === "verified",
);
export const institution = {
  id: "kogakuin",
  name: "工学院大学",
  facultyPrefixes: {
    J: {
      id: "information",
      label: "情報学部",
      departments: { "1": { id: "cs", label: "コンピュータ科学科" } },
    },
  },
};
export const studentNumberPolicy = {
  pattern: /^([A-Z])(\d)(\d{2})(\d{3})$/,
  years: { "24": 2024 } as Record<string, number>,
  source:
    "依頼者提供のJ124241例に基づく初期版の入力形式。大学公式の桁数仕様は未確認。",
};
export function parseStudentNumber(input: string) {
  const normalized = input.normalize("NFKC").trim().toUpperCase();
  const m = studentNumberPolicy.pattern.exec(normalized);
  if (!m)
    return {
      normalized,
      supported: false,
      label:
        "形式を確認できません。初期版は英字1文字＋数字6桁の例に対応しています。",
    };
  const faculties = institution.facultyPrefixes as Record<
    string,
    {
      id: string;
      label: string;
      departments: Record<string, { id: string; label: string }>;
    }
  >;
  const f = faculties[m[1]],
    d = f?.departments[m[2]],
    year = studentNumberPolicy.years[m[3]];
  const candidate = registry.find(
    (c) =>
      c.university === institution.id &&
      c.faculty === f?.id &&
      c.department === d?.id &&
      c.entryYear === year,
  );
  return {
    normalized,
    supported: !!candidate,
    curriculumId: candidate?.id,
    // Display labels for auto-filling the form after login; present only when supported.
    entryYear: candidate ? String(candidate.entryYear) : undefined,
    facultyLabel: candidate ? f?.label : undefined,
    departmentLabel: candidate ? d?.label : undefined,
    label:
      candidate?.label ??
      "対象外です。別年度・別学科のルールへは切り替えません。",
  };
}
export const sectionLabels: Record<string, string> = {
  "I-a": "総合文化",
  "I-b": "外国語",
  "I-c": "保健体育",
  "I-d": "キャリア支援",
  "II-a": "共通基礎",
  "II-b": "専門基礎",
  "III-A": "専門 A",
  "III-B": "専門 B",
  "III-C": "専門 C",
  "III-common": "専門 共通",
  external: "他学科（学部枠）",
  thesis: "卒業論文",
  excluded: "算入対象外",
};

export function selectManualCurriculum(
  year: string,
  faculty: string,
  department: string,
) {
  const clean = (value: string) => value.normalize("NFKC").trim();
  const f = Object.values(institution.facultyPrefixes).find(
    (x) => x.label === clean(faculty),
  );
  const d =
    f &&
    Object.values(f.departments).find((x) => x.label === clean(department));
  return registry.find(
    (c) =>
      c.university === institution.id &&
      c.faculty === f?.id &&
      c.department === d?.id &&
      String(c.entryYear) === clean(year),
  );
}
