import { describe, expect, it } from "vitest";
import { courseMaster, official } from "../src/data/registry";
import { summarizeGrades } from "../src/domain/summary";
import type { Grade } from "../src/domain/schema";

const id = (name: string) => official.courses.find((x) => x.name === name)!.id;
let n = 0;
const grade = (patch: Partial<Grade>): Grade => ({
  id: `g${n++}`,
  courseId: "",
  name: "",
  code: "",
  credits: "",
  evaluation: "",
  year: "2025",
  status: "unknown",
  confirmed: false,
  provenance: { kind: "pdf", page: 1, raw: "" },
  ...patch,
});
const course = (name: string, evaluation: string, credits = "2") =>
  grade({
    name,
    courseId: id(name),
    masterId: id(name),
    credits,
    evaluation,
    status: evaluation === "F" ? "failed" : evaluation ? "earned" : "enrolled",
  });

describe("単位の集計（gpa_2024.pdf の同一科目ルール）", () => {
  it("取得単位・評価ごとの単位を数える", () => {
    const s = summarizeGrades([
      course("文学A", "A+"),
      course("哲学A", "B"),
      course("Basic English I", "C", "1"),
    ]);
    expect(s.courses).toBe(3);
    expect(s.earned).toBe(500);
    expect(s.byGrade).toEqual({ "A+": 200, A: 0, B: 200, C: 100, D: 0, F: 0 });
    expect(s.failed).toBe(0);
  });

  it("Fのあと再履修で合格した科目は落単にしない（最も良い評価の1回分）", () => {
    const s = summarizeGrades([course("文学A", "F", ""), course("文学A", "B")]);
    expect(s.courses).toBe(1);
    expect(s.earned).toBe(200);
    expect(s.failed).toBe(0);
    expect(s.failedCourses).toEqual([]);
    expect(s.byGrade.B).toBe(200);
    expect(s.byGrade.F).toBe(0);
  });

  it("Fのままの科目は落単。空欄の単位数はマスターで補い、2回Fでも1科目分", () => {
    const s = summarizeGrades(
      [
        course("コンピュータアーキテクチャ", "F", ""),
        course("コンピュータアーキテクチャ", "F", ""),
      ],
      courseMaster,
    );
    expect(s.failed).toBe(200);
    expect(s.failedCourses).toEqual([
      { name: "コンピュータアーキテクチャ", credits: 200, retaking: false },
    ]);
    expect(s.byGrade.F).toBe(200);
  });

  it("Fの科目を再履修中（※）なら「再履修中」と添えて落単のまま", () => {
    const s = summarizeGrades([course("文学A", "F"), course("文学A", "")]);
    expect(s.failed).toBe(200);
    expect(s.failedCourses[0].retaking).toBe(true);
    // Ku-portの「履修中単位」と同じく、再履修中の分も履修中に含める
    expect(s.enrolled).toBe(200);
  });

  it("再掲された同じ科目（数理・データサイエンス区分など）は二重に数えない", () => {
    const s = summarizeGrades([
      course("情報学基礎論Ⅰ", "B"),
      course("情報学基礎論Ⅰ", "B"),
    ]);
    expect(s.courses).toBe(1);
    expect(s.earned).toBe(200);
  });

  it("他学科の科目と自学科の同名科目は別の科目として数える", () => {
    const theirs = courseMaster.courses.find(
      (x) => x.name === "機械学習" && x.department === "is",
    )!;
    const s = summarizeGrades(
      [
        grade({
          name: "機械学習",
          masterId: theirs.id,
          otherDepartment: true,
          evaluation: "F",
          status: "failed",
        }),
        course("機械学習", "A"),
      ],
      courseMaster,
    );
    expect(s.courses).toBe(2);
    expect(s.earned).toBe(200);
    expect(s.failed).toBe(200);
  });

  it("履修中の単位と、単位数が分からない科目を分けて示す", () => {
    const s = summarizeGrades([
      course("哲学B", ""),
      grade({ name: "未知の科目", evaluation: "F", status: "failed" }),
    ]);
    expect(s.enrolled).toBe(200);
    expect(s.failed).toBe(0);
    expect(s.failedCourses).toEqual([
      { name: "未知の科目", credits: null, retaking: false },
    ]);
    expect(s.unknownCredits).toEqual(["未知の科目"]);
  });

  it("評価記号のない手入力の行は修得状況で数える", () => {
    const s = summarizeGrades([
      grade({
        name: "文学A",
        courseId: id("文学A"),
        credits: "2",
        status: "earned",
      }),
      grade({
        name: "哲学A",
        courseId: id("哲学A"),
        credits: "2",
        status: "failed",
      }),
    ]);
    expect(s.earned).toBe(200);
    expect(s.failed).toBe(200);
    expect(s.byGrade.F).toBe(0); // 評価記号がないので評価ごとの内訳には入れない
  });
});
