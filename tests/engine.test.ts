import { describe, it, expect } from "vitest";
import {
  official,
  parseStudentNumber,
  validateCurriculum,
} from "../src/data/registry";
import { evaluateCurriculum, matchCourse } from "../src/domain/engine";
import {
  units,
  type Curriculum,
  type Grade,
  type Expression,
} from "../src/domain/schema";
import { demoGrades } from "../src/data/demo";
import {
  parseTextLines,
  identityIssue,
  validatePdfFile,
} from "../src/pdf/normalize";
import { canUseDemo, allowedIdentity, authReady } from "../src/auth/session";
const all = () => demoGrades(official, true);
const run = (g: Grade[]) => evaluateCurriculum(official, g);
function fixture() {
  const c = structuredClone(official);
  c.id = "fictional-2030-other-v1";
  c.department = "fictional";
  c.entryYear = 2030;
  c.releaseStatus = "fixture";
  c.label = "架空カリキュラム";
  c.courses = c.courses.slice(0, 4);
  c.placements = c.placements.slice(0, 4).map((p, i) => ({
    ...p,
    credits: ["1.5", "2", "2", "2"][i],
    kind: "elective" as const,
    section: "fiction",
    external: i > 0,
  }));
  c.rules = [];
  c.caps = [
    {
      id: "fiction-cap",
      maximum: "3",
      selector: { external: true },
      source: c.source,
    },
  ];
  c.totalRuleId = c.id + "-total";
  return c;
}
function addRule(c: Curriculum, expression: Expression, id = "total") {
  c.rules.push({
    id: c.id + "-" + id,
    curriculumId: c.id,
    entryYear: c.entryYear,
    department: c.department,
    assessment: "graduation",
    label: "架空条件",
    source: c.source,
    expression,
  });
}
describe("学籍番号・適用範囲", () => {
  it("NFKC、空白、大小文字を正規化", () =>
    expect(parseStudentNumber(" ｊ１２４２４１ ").curriculumId).toBe(
      official.id,
    ));
  it.each([
    "J125241",
    "J224241",
    "A124241",
    "J124",
    "J12424199",
    "J1XX241",
    "",
  ])("対象外/未知 %s", (id) =>
    expect(parseStudentNumber(id).supported).toBe(false),
  );
  it("PDF学籍番号の不一致・複数番号を検出", () => {
    expect(identityIssue("J124000", ["J124001"])).toBeTruthy();
    expect(identityIssue("J124000", ["J124000", "J124001"])).toBeTruthy();
    expect(identityIssue("J124000", [])).toBeNull();
  });
});
describe("公式カリキュラムの卒業単位チェック", () => {
  it("全条件充足", () => expect(run(all()).status).toBe("met"));
  it("科目163件、必修専門29単位、文化49科目を検査", () => {
    expect(official.courses).toHaveLength(163);
    expect(official.placements.filter((p) => p.section === "I-a")).toHaveLength(
      49,
    );
    expect(
      official.placements
        .filter(
          (p) =>
            p.kind === "required" &&
            ["II-b", "III-A", "III-B", "III-C", "III-common"].includes(
              p.section,
            ),
        )
        .reduce((n, p) => n + units(p.credits), 0),
    ).toBe(2900);
  });
  it("合計が足りても必修不足", () => {
    const id = official.placements.find((p) => p.kind === "required")!.courseId;
    const r = run(all().filter((g) => g.courseId !== id));
    expect(r.earned).toBeGreaterThan(12400);
    expect(r.status).toBe("unmet");
    expect(
      r.results.find((x) => x.id.endsWith("-mandatory"))?.missingCourses,
    ).toContain(id);
  });
  it("合計が足りても文化の区分不足", () => {
    const r = run(
      all().filter(
        (g) =>
          official.placements.find((p) => p.courseId === g.courseId)
            ?.section !== "I-a",
      ),
    );
    expect(r.earned).toBeGreaterThanOrEqual(12400);
    expect(r.results.find((x) => x.id.endsWith("-I-a"))?.status).toBe("unmet");
  });
  it("選択必修のA区分不足（選択科目だけでは満たさない）", () => {
    const r = run(
      all().filter((g) => {
        const p = official.placements.find((p) => p.courseId === g.courseId)!;
        return !(p.section === "III-A" && p.kind === "selective");
      }),
    );
    expect(
      r.results.find((x) => x.id.endsWith("III-A-selective"))?.status,
    ).toBe("unmet");
    expect(r.earned).toBeGreaterThan(12400);
  });
  it("再履修・重複の順序に依存せず一回算入", () => {
    const gs = all();
    const old = { ...gs[0], id: "repeat", status: "failed" as const };
    expect(run([...gs, old, ...gs]).earned).toBe(run(gs).earned);
    expect(run([...gs, old].reverse()).earned).toBe(run(gs).earned);
  });
  it.each(["failed", "enrolled", "ungraded"] as const)(
    "%sは算入しない",
    (status) => expect(run([{ ...all()[0], status }]).earned).toBe(0),
  );
  it("小数単位の整数演算", () => {
    expect(units("1.5") + units("0.1") + units("0.2")).toBe(180);
    expect(() => units("1.234")).toThrow();
  });
  it("情報と職業は算入対象外", () => {
    const p = official.placements.find((p) => !p.eligible)!;
    const row = {
      ...all()[0],
      courseId: p.courseId,
      name: "情報と職業",
      credits: p.credits,
    };
    const r = run([row]);
    expect(r.earned).toBe(0);
    expect(r.notes[0]).toContain("算入対象外");
  });
  it("未知の科目・未知の評価・未確認行は要確認", () => {
    expect(
      run([
        ...all(),
        { ...all()[0], id: "unknown", courseId: "missing", name: "不明科目" },
      ]).status,
    ).toBe("review");
    expect(
      run([{ ...all()[0], status: "unknown", evaluation: "ZZ" }]).status,
    ).toBe("review");
    expect(run([{ ...all()[0], confirmed: false }]).status).toBe("review");
  });
  it("同名の別学科科目を名前だけで混同しない", () => {
    const c = structuredClone(official);
    c.courses.push({ ...c.courses[0], id: "other", department: "other" });
    expect(matchCourse(c, c.courses[0].name)).toBeUndefined();
  });
  it("単位修正で結果が更新、値の不一致は算入しない", () => {
    const gs = all();
    expect(run(gs).status).toBe("met");
    gs[0] = { ...gs[0], credits: "999" };
    expect(run(gs).status).toBe("review");
  });
  it("対象データの根拠は2024年度、資料公開年を推測しない", () => {
    expect(official.entryYear).toBe(2024);
    expect(official.publicationYear).toBeNull();
  });
});
describe("共通エンジンの拡張", () => {
  it("他年度の同科目を別ルールで判定・上限・小数", () => {
    const c = fixture();
    addRule(c, { type: "credits", minimum: "4.5", selector: {} });
    const r = evaluateCurriculum(c, demoGrades(c, true), {
      allowFixture: true,
    });
    expect(r.earned).toBe(450);
    expect(r.status).toBe("met");
    expect(() => evaluateCurriculum(c, [])).toThrow();
  });
  it("同科目の必修区分変更で別の結果", () => {
    const c = fixture();
    c.placements[0].kind = "required";
    addRule(c, { type: "allCourses", courseIds: [c.placements[0].courseId] });
    const missing = demoGrades(c, true).slice(1);
    expect(evaluateCurriculum(c, missing, { allowFixture: true }).status).toBe(
      "unmet",
    );
    c.placements[0].kind = "elective";
    c.rules[0].expression = { type: "credits", minimum: "2", selector: {} };
    expect(evaluateCurriculum(c, missing, { allowFixture: true }).status).toBe(
      "met",
    );
  });
  it("AND/OR、科目数と科目集合、選択集合を扱う", () => {
    const c = fixture();
    addRule(c, {
      type: "and",
      children: [
        { type: "count", minimum: 2, selector: {} },
        {
          type: "or",
          children: [
            { type: "allCourses", courseIds: [c.courses[0].id] },
            { type: "credits", minimum: "90", selector: {} },
          ],
        },
      ],
    });
    expect(
      evaluateCurriculum(c, demoGrades(c, true), { allowFixture: true }).status,
    ).toBe("met");
  });
  it("代替・同等科目は根拠付き対応だけ適用し重複排除", () => {
    const c = fixture();
    c.caps = [];
    c.equivalences = [
      { from: c.courses[1].id, to: c.courses[0].id, source: c.source },
    ];
    c.placements[0].credits = "2";
    addRule(c, { type: "allCourses", courseIds: [c.courses[0].id] });
    const gs = demoGrades(c, true).slice(0, 2);
    expect(evaluateCurriculum(c, gs, { allowFixture: true }).earned).toBe(200);
  });
  it("異なるカリキュラムのルール混入を拒否", () => {
    const c = fixture();
    c.rules = [official.rules[0]];
    expect(() => validateCurriculum(c)).toThrow("混入");
  });
  it("未知のルールを無視しない", () => {
    const c = fixture();
    addRule(c, { type: "credits", minimum: "1", selector: {} });
    (c.rules[0] as unknown as { expression: unknown }).expression = {
      type: "unsupported",
    };
    expect(() => validateCurriculum(c)).toThrow();
  });
  it("未対応の重複上限・部分配分は拒否", () => {
    const c = fixture();
    c.caps.push({ ...c.caps[0], id: "duplicate" });
    expect(() => validateCurriculum(c)).toThrow("上限");
    const d = fixture();
    addRule(d, {
      type: "credits",
      minimum: "1",
      selector: { courseIds: [d.courses[1].id] },
    });
    expect(() => validateCurriculum(d)).toThrow("配分");
  });
  it("未確認ルールは要確認", () => {
    const c = fixture();
    addRule(c, { type: "credits", minimum: "1", selector: {} });
    c.rules[0].source = { ...c.source, status: "pending" };
    expect(
      evaluateCurriculum(c, demoGrades(c, true), { allowFixture: true }).status,
    ).toBe("review");
  });
});
describe("PDF取り込み境界と学校認証", () => {
  it("サイズ・形式を検査", () => {
    expect(() =>
      validatePdfFile({
        size: 21 * 1024 * 1024,
        name: "x.pdf",
        type: "application/pdf",
      }),
    ).toThrow("20MB");
    expect(() => validatePdfFile({ size: 0, name: "x.pdf", type: "" })).toThrow(
      "空",
    );
    expect(() => validatePdfFile({ size: 3, name: "x.png", type: "" })).toThrow(
      "PDF",
    );
  });
  it("原文・ページを保存、未知評価から合格を推測しない", () => {
    const raw = "未知科目 | | 1.5 | ZZ | 2025 | 不明";
    const r = parseTextLines(
      [
        {
          page: 2,
          y: 700,
          text: raw,
          items: [{ str: raw, x: 40, width: 100 }],
        },
        {
          page: 1,
          y: 700,
          text: "学籍番号 J124000",
          items: [{ str: "学籍番号 J124000", x: 40, width: 100 }],
        },
      ],
      official,
    );
    expect(r.identifiers).toEqual(["J124000"]);
    expect(r.grades[0].status).toBe("unknown");
    expect(r.grades[0].provenance.raw).toBe(raw);
    expect(r.grades[0].provenance.page).toBe(2);
    expect(r.grades[0].confirmed).toBe(false);
  });
  it("認証の許可ドメインと所有確認を区別", () => {
    expect(allowedIdentity("test@example.edu", true, ["example.edu"])).toBe(
      true,
    );
    expect(allowedIdentity("test@example.edu", false, ["example.edu"])).toBe(
      false,
    );
    expect(
      allowedIdentity("test@example.edu.evil", true, ["example.edu"]),
    ).toBe(false);
    expect(
      authReady({
        clientId: "",
        allowedDomains: [],
      }),
    ).toBe(false);
  });
  it("本番のデモ回避は許可しない", () => {
    expect(canUseDemo(false, "localhost")).toBe(false);
    expect(canUseDemo(true, "example.com")).toBe(false);
    expect(canUseDemo(true, "127.0.0.1")).toBe(true);
  });
});
