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
      // 学科記号 J0〜J3（学生便覧 office2023.pdf「学籍番号」で確認、docs/evidence.md）。
      departments: {
        "0": { id: "ic", label: "情報通信工学科" },
        "1": { id: "cs", label: "コンピュータ科学科" },
        "2": { id: "id", label: "情報デザイン学科" },
        "3": { id: "is", label: "情報科学科" },
      },
      // JX: 2年次後期にJ0〜J3へ振り分けられるが記号は変わらない。学科は本人が選ぶ。
      undecided: "X",
    },
  },
};
export const studentNumberPolicy = {
  // 学科記号2文字＋入学年度の下2けた＋出席番号3けた（メールアドレスではハイフンなし）。
  pattern: /^([A-Z])([0-9A-Z])(\d{2})(\d{3})$/,
  years: { "24": 2024 } as Record<string, number>,
  // 転籍・編入学の出席番号は401以降。
  transferFrom: 401,
  source:
    "学生便覧（2023年度版）の学籍番号：2文字の学科記号＋入学年度下2けた＋出席番号3けた。情報学部はJ0=情報通信工・J1=コンピュータ科学・J2=情報デザイン・J3=情報科学、JX=学科未定（振り分け後も記号は変わらない）。転籍・編入学は出席番号401以降。",
};
interface Faculty {
  id: string;
  label: string;
  departments: Record<string, { id: string; label: string }>;
  undecided?: string;
}
export interface DepartmentChoice {
  curriculumId: string;
  departmentLabel: string;
}
export function parseStudentNumber(input: string) {
  const normalized = input.normalize("NFKC").trim().toUpperCase();
  const m = studentNumberPolicy.pattern.exec(normalized);
  if (!m)
    return {
      normalized,
      supported: false,
      choices: [] as DepartmentChoice[],
      transferred: false,
      label:
        "形式を確認できません。学科記号2文字＋数字5けた（例：J124241）の学籍番号に対応しています。",
    };
  const faculties = institution.facultyPrefixes as Record<string, Faculty>;
  const f = faculties[m[1]],
    year = studentNumberPolicy.years[m[3]];
  const undecided = !!f?.undecided && m[2] === f.undecided;
  const departments = undecided
    ? Object.values(f.departments)
    : [f?.departments[m[2]]].filter((d) => !!d);
  // Curricula this number can use: one for J0〜J3, every department for JX.
  const choices = departments.flatMap((d) => {
    const c = registry.find(
      (x) =>
        x.university === institution.id &&
        x.faculty === f.id &&
        x.department === d.id &&
        x.entryYear === year,
    );
    return c ? [{ curriculumId: c.id, departmentLabel: d.label }] : [];
  });
  const candidate = undecided
    ? undefined
    : registry.find((x) => x.id === choices[0]?.curriculumId);
  const supported = undecided ? choices.length > 0 : !!candidate;
  return {
    normalized,
    supported,
    curriculumId: candidate?.id,
    // Display labels for auto-filling the form after login; present only when supported.
    entryYear: supported ? String(year) : undefined,
    facultyLabel: supported ? f.label : undefined,
    departmentLabel: candidate ? choices[0].departmentLabel : undefined,
    // JX: the department cannot be read from the number; the student picks it.
    choices: undecided && supported ? choices : [],
    transferred: Number(m[4]) >= studentNumberPolicy.transferFrom,
    label:
      candidate?.label ??
      (supported
        ? "学籍番号から学科を判定できません（JX）。振り分けられた学科を選んでください。"
        : "対象外です。別年度・別学科のルールへは切り替えません。"),
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
