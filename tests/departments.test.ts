import { describe, expect, it } from "vitest";
import {
  courseMaster,
  curricula,
  parseStudentNumber,
} from "../src/data/registry";
import { evaluateCurriculum } from "../src/domain/engine";
import {
  isExcludedSimilar,
  lookupMaster,
  masterKey,
} from "../src/domain/master";
import { combinedShortfall } from "../src/domain/shortfall";
import { units, type Curriculum, type Grade } from "../src/domain/schema";
import { syntheticGrades } from "./synthetic-grades";

const { ic, id, is } = curricula;
const others = [
  ["情報通信工学科", ic],
  ["情報デザイン学科", id],
  ["情報科学科", is],
] as const;

const rule = (c: Curriculum, suffix: string) =>
  c.rules.find((r) => r.id === `${c.id}-${suffix}`)!;
const result = (r: ReturnType<typeof evaluateCurriculum>, suffix: string) =>
  [...r.results, ...r.thesisEntry.results].find((x) =>
    x.id.endsWith(`-${suffix}`),
  )!;
const idOf = (c: Curriculum, name: string) =>
  c.courses.find((x) => masterKey(x.name) === masterKey(name))!.id;
const without = (c: Curriculum, ...names: string[]) => {
  const ids = names.map((n) => idOf(c, n));
  return syntheticGrades(c).filter((g) => !ids.includes(g.courseId));
};
// A course listed under the PDF's 情報系他学科科目 heading.
function external(c: Curriculum, name: string): Grade {
  const found = lookupMaster(courseMaster, c, name, { otherDepartment: true });
  return {
    id: `ext-${name}`,
    courseId: "",
    masterId: found.entry?.id ?? "",
    name,
    code: "",
    credits: found.entry?.credits ?? "",
    evaluation: "A",
    year: "2025",
    status: "earned",
    confirmed: true,
    otherDepartment: true,
    provenance: { kind: "manual", raw: "架空の検証用データ" },
  };
}

describe("学籍番号の2文字目で学科を決める", () => {
  it.each([
    ["J024001", "ic", "情報通信工学科"],
    ["J124241", "cs", "コンピュータ科学科"],
    ["J224001", "id", "情報デザイン学科"],
    ["J324001", "is", "情報科学科"],
  ])("%s → %s", (student, dept, label) => {
    const p = parseStudentNumber(student);
    expect(p.supported).toBe(true);
    expect(p.curriculumId).toBe(curricula[dept as keyof typeof curricula].id);
    expect(p.departmentLabel).toBe(label);
  });
  it("2025年度入学など未登録の年度は対象外", () =>
    expect(parseStudentNumber("J225001").supported).toBe(false));
});

describe("学籍番号JX（学科未定）と転籍・編入学（学生便覧）", () => {
  it("JXは学科を決めず、4学科から本人が選ぶ", () => {
    const p = parseStudentNumber("jx24001");
    expect(p.supported).toBe(true);
    expect(p.curriculumId).toBeUndefined();
    expect(p.departmentLabel).toBeUndefined();
    expect(p.facultyLabel).toBe("情報学部");
    expect(p.entryYear).toBe("2024");
    expect(p.choices).toEqual([
      { curriculumId: curricula.ic.id, departmentLabel: "情報通信工学科" },
      { curriculumId: curricula.cs.id, departmentLabel: "コンピュータ科学科" },
      { curriculumId: curricula.id.id, departmentLabel: "情報デザイン学科" },
      { curriculumId: curricula.is.id, departmentLabel: "情報科学科" },
    ]);
  });
  it("学科が決まる番号は選択肢を出さない", () =>
    expect(parseStudentNumber("J124241").choices).toEqual([]));
  it.each(["JX25001", "AX24001", "J424001"])("%s は対象外", (id) => {
    const p = parseStudentNumber(id);
    expect(p.supported).toBe(false);
    expect(p.choices).toEqual([]);
  });
  it.each([
    ["J124400", false],
    ["J124401", true],
    ["JX24450", true],
  ])("%s 転籍・編入学（出席番号401以降）= %s", (id, transferred) => {
    const p = parseStudentNumber(id);
    expect(p.supported).toBe(true);
    expect(p.transferred).toBe(transferred);
  });
});

describe.each(others)("%s（2024年度入学）", (label, c) => {
  const mine = courseMaster.courses.filter(
    (x) => x.department === c.department,
  );

  it("科目マスターの全科目を同じIDで収録し、出典は公式PDF", () => {
    expect(c.courses.map((x) => x.id)).toEqual(mine.map((x) => x.id));
    expect(c.source.sha256).toBe(
      courseMaster.departments[c.department].source.sha256,
    );
    expect(c.label).toContain(label);
  });

  it("全科目修得なら卒業・卒論着手とも条件を満たす", () => {
    const r = evaluateCurriculum(c, syntheticGrades(c), {
      master: courseMaster,
    });
    expect(r.status).toBe("met");
    expect(r.thesisEntry.status).toBe("met");
  });

  it("専門の必修単位の合計がp4の値と一致する", () => {
    const e = rule(c, "mandatory-special").expression;
    if (e.type !== "credits") throw new Error();
    const total = c.placements
      .filter(
        (p) =>
          e.selector.sections!.includes(p.section) && p.kind === "required",
      )
      .reduce((a, p) => a + units(p.credits), 0);
    expect(total).toBe(units(e.minimum));
  });

  it("卒論・情報と職業の扱い", () => {
    expect(
      c.placements.find((p) => p.courseId === idOf(c, "卒業論文(PBL)"))
        ?.section,
    ).toBe("thesis");
    const job = c.placements.find((p) => p.courseId === idOf(c, "情報と職業"))!;
    expect(job.eligible).toBe(false);
  });

  it("注1の類似科目はすべて他学科の第Ⅱ群b・第Ⅲ群にあり、算入されない", () => {
    for (const e of c.excludedExternal) {
      const hits = courseMaster.courses.filter(
        (x) =>
          masterKey(x.name) === masterKey(e.name) &&
          courseMaster.departments[x.department].label === e.department,
      );
      expect(hits, e.name).toHaveLength(1);
      expect(hits[0].department).not.toBe(c.department);
      expect(["II-b", "III"]).toContain(hits[0].group);
      expect(isExcludedSimilar(courseMaster, c, hits[0])).toBe(true);
    }
  });

  it("卒業論文がないと卒業は未達、不足は8単位", () => {
    const r = evaluateCurriculum(c, without(c, "卒業論文(PBL)"), {
      master: courseMaster,
    });
    expect(r.status).toBe("unmet");
    expect(combinedShortfall(c, r.results)).toBe(800);
  });
});

describe("情報通信工学科：p4注3（第Ⅱ群b・第Ⅲ群をまたぐ3区分）", () => {
  const smart = [
    "電気回路理論Ⅱ",
    "電気回路理論演習Ⅱ",
    "アナログ電子回路Ⅰ",
    "電磁気学",
    "電磁気学演習",
    "電子デバイス工学",
  ];
  it("3区分の科目はそれぞれ6科目", () => {
    for (const area of ["smart", "net", "media"])
      expect(c(area)).toHaveLength(6);
    function c(area: string) {
      return ic.placements.filter((p) => p.area === area);
    }
  });
  it("スマートデバイスを1単位も取らないと、選択必修12単位を満たしていても未達", () => {
    const r = evaluateCurriculum(ic, without(ic, ...smart), {
      master: courseMaster,
    });
    expect(result(r, "selective").status).toBe("met");
    expect(result(r, "area-smart").status).toBe("unmet");
    expect(result(r, "entry-area-smart").status).toBe("unmet");
    expect(r.status).toBe("unmet");
    // 2単位の科目を1つ取れば足りる
    expect(combinedShortfall(ic, r.results)).toBe(200);
  });
});

describe("情報科学科：p4注3・注4", () => {
  it("経営情報の選択必修がないと未達", () => {
    const names = [
      "マーケティング概論",
      "ミクロ経済学",
      "デジタル経済学",
      "企業システム研究",
    ];
    const r = evaluateCurriculum(is, without(is, ...names), {
      master: courseMaster,
    });
    expect(result(r, "III-A-selective").status).toBe("unmet");
    expect(result(r, "III-A-selective").label).toBe("経営情報 選択必修");
  });
  it("他学科の科目は卒業の71単位には入るが、卒論着手の65単位には入らない", () => {
    const special = rule(is, "special").expression;
    const entry = rule(is, "entry-special").expression;
    if (special.type !== "credits" || entry.type !== "credits")
      throw new Error();
    expect(special.selector.sections).toContain("external");
    expect(entry.selector.sections).not.toContain("external");
    const r = evaluateCurriculum(is, [external(is, "CG数学")], {
      master: courseMaster,
    });
    expect(result(r, "special").earned).toBe(200);
    expect(result(r, "entry-special").earned).toBe(0);
  });
  it("CSの「機械学習」は類似科目なので算入しない（自学科の機械学習は算入）", () => {
    const r = evaluateCurriculum(is, [external(is, "機械学習")], {
      master: courseMaster,
    });
    expect(r.earned).toBe(0);
    expect(r.notes.join()).toContain("類似科目");
  });
});

describe("情報デザイン学科", () => {
  it("区分ごとの選択必修条件（注3）はない", () => {
    expect(
      id.rules.some((r) => /-(III-.+-selective|area-.+)$/.test(r.id)),
    ).toBe(false);
  });
  it("「知的財産」はCS・情報通信工のどちらでも類似科目なので算入しない", () => {
    const r = evaluateCurriculum(id, [external(id, "知的財産")], {
      master: courseMaster,
    });
    expect(r.earned).toBe(0);
  });
  it("類似科目でない他学科の科目は学部枠（最大6単位）に入る", () => {
    const gs = [
      "通信工学",
      "無線通信工学",
      "Webプログラミング",
      "データベース論",
    ].map((n) => external(id, n));
    const r = evaluateCurriculum(id, gs, { master: courseMaster });
    expect(result(r, "special").earned).toBe(600);
  });
});
