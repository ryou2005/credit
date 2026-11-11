import raw from "./kogakuin-2024.json";
import rawIc from "./kogakuin-2024-ic.json";
import rawId from "./kogakuin-2024-id.json";
import rawIs from "./kogakuin-2024-is.json";
import rawMaster from "./course-master.json";
import { validateCurriculum } from "../domain/validate";
import { validateCourseMaster } from "../domain/master";
import type { Curriculum } from "../domain/schema";
export { validateCurriculum } from "../domain/validate";
// コンピュータ科学科 (hand-checked, docs/evidence.md). The other three are built
// by scripts/build-curricula.mjs from the course master and each PDF's p4.
export const official = validateCurriculum(raw);
export const curricula = {
  ic: validateCurriculum(rawIc),
  cs: official,
  id: validateCurriculum(rawId),
  is: validateCurriculum(rawIs),
};
export const courseMaster = validateCourseMaster(rawMaster);
export const registry = Object.values(curricula).filter(
  (c) => c.releaseStatus === "verified",
);
export const institution = {
  id: "kogakuin",
  name: "工学院大学",
  facultyPrefixes: {
    J: {
      id: "information",
      label: "情報学部",
      // 2文字目の数字（依頼者確認、2026-11-11）
      departments: {
        "0": { id: "ic", label: "情報通信工学科" },
        "1": { id: "cs", label: "コンピュータ科学科" },
        "2": { id: "id", label: "情報デザイン学科" },
        "3": { id: "is", label: "情報科学科" },
      },
    },
  },
};
export const studentNumberPolicy = {
  pattern: /^([A-Z])(\d)(\d{2})(\d{3})$/,
  years: { "24": 2024 } as Record<string, number>,
  source:
    "依頼者提供のJ124241例と学科番号（情報通信工0・コンピュータ科学1・情報デザイン2・情報科学3）に基づく初期版の入力形式。大学公式の桁数仕様は未確認。",
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
// A section's display name in this curriculum (its own 第Ⅲ群 区分 names first).
export const sectionLabel = (c: Curriculum, section: string) =>
  c.sectionLabels?.[section] ?? sectionLabels[section];

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
