import { describe, expect, it } from "vitest";
import { courseMaster, official } from "../src/data/registry";
import {
  isExcludedSimilar,
  lookupMaster,
  masterKey,
  validateCourseMaster,
} from "../src/domain/master";

const other = { otherDepartment: true };

describe("科目マスター（情報学部4学科のカリキュラム表）", () => {
  it("4学科すべての科目を収録し、出典のハッシュ値を持つ", () => {
    const count = (d: string) =>
      courseMaster.courses.filter((x) => x.department === d).length;
    expect(count("ic")).toBe(168);
    expect(count("cs")).toBe(163);
    expect(count("id")).toBe(161);
    expect(count("is")).toBe(160);
    for (const d of Object.values(courseMaster.departments))
      expect(d.source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("コンピュータ科学科の分は判定データと科目ID・名前・単位数が一致する", () => {
    const cs = courseMaster.courses.filter((x) => x.department === "cs");
    expect(cs.map((x) => x.id).sort()).toEqual(
      official.courses.map((x) => x.id).sort(),
    );
    for (const x of cs) {
      const course = official.courses.find((c) => c.id === x.id)!;
      const placement = official.placements.find((p) => p.courseId === x.id)!;
      expect(masterKey(x.name)).toBe(masterKey(course.name));
      expect(x.credits).toBe(placement.credits);
    }
  });

  it("p4注1の類似科目13件はすべて他学科の第Ⅱ群b・第Ⅲ群に存在する", () => {
    expect(official.excludedExternal).toHaveLength(13);
    for (const e of official.excludedExternal) {
      const hits = courseMaster.courses.filter(
        (x) =>
          masterKey(x.name) === masterKey(e.name) &&
          courseMaster.departments[x.department].label === e.department,
      );
      expect(hits, e.name).toHaveLength(1);
      expect(["II-b", "III"]).toContain(hits[0].group);
      expect(isExcludedSimilar(courseMaster, official, hits[0])).toBe(true);
    }
  });

  it("同名の「機械学習」：自学科の見出しではCS、他学科の見出しでは情報科学科（算入不可）", () => {
    const own = lookupMaster(courseMaster, official, "機械学習");
    expect(own.entry?.department).toBe("cs");
    expect(isExcludedSimilar(courseMaster, official, own.entry!)).toBe(false);
    const theirs = lookupMaster(courseMaster, official, "機械学習", other);
    expect(theirs.entry?.department).toBe("is");
    expect(isExcludedSimilar(courseMaster, official, theirs.entry!)).toBe(true);
  });

  it("他学科の「デジタル信号処理」は2学科にあるが同じ扱いなので選択不要", () => {
    const r = lookupMaster(courseMaster, official, "デジタル信号処理", other);
    expect(r.candidates.map((x) => x.department).sort()).toEqual(["ic", "id"]);
    expect(r.needsChoice).toBe(false);
    expect(r.entry?.credits).toBe("2");
    const lab = lookupMaster(
      courseMaster,
      official,
      "デジタル信号処理演習",
      other,
    );
    expect(lab.entry?.department).toBe("id");
    expect(lab.entry?.credits).toBe("1");
  });

  it("他学科の検索は第Ⅱ群b・第Ⅲ群だけ（第Ⅰ群・第Ⅱ群aは学部枠の対象外）", () => {
    expect(
      lookupMaster(courseMaster, official, "微分及び演習", other).candidates,
    ).toHaveLength(0);
    // 自学科として探せば見つかる
    expect(
      lookupMaster(courseMaster, official, "微分及び演習").entry?.credits,
    ).toBe("1.5");
  });

  it("似た名前は同じ科目にしない（数値計算法 ≠ 数値計算法概論）", () => {
    expect(
      lookupMaster(courseMaster, official, "数値計算法").candidates,
    ).toHaveLength(0);
    const ic = lookupMaster(courseMaster, official, "数値計算法", other);
    expect(ic.entry?.department).toBe("ic");
    expect(isExcludedSimilar(courseMaster, official, ic.entry!)).toBe(true);
  });

  it("空白・全角・ローマ数字の表記ゆれは吸収する", () => {
    expect(
      lookupMaster(courseMaster, official, "情報学基礎論I").entry?.id,
    ).toBe(lookupMaster(courseMaster, official, "情報学基礎論Ⅰ").entry?.id);
    expect(
      lookupMaster(courseMaster, official, "Basic Eng.I").entry?.name,
    ).toBe("Basic English I");
  });

  it("単位数や算入可否が学科で違う同名科目は、本人に学科を選ばせる", () => {
    const base = courseMaster.courses.find((x) => x.name === "数値計算法")!;
    const m = validateCourseMaster({
      ...courseMaster,
      courses: [
        ...courseMaster.courses,
        { ...base, id: "kgu-is-999", department: "is", credits: "1" },
      ],
    });
    const r = lookupMaster(m, official, "数値計算法", other);
    expect(r.needsChoice).toBe(true);
    expect(r.entry).toBeUndefined();
    expect(r.candidates).toHaveLength(2);
  });

  it("重複IDや未知の学科は拒否する", () => {
    const [first] = courseMaster.courses;
    expect(() =>
      validateCourseMaster({
        ...courseMaster,
        courses: [first, first],
      }),
    ).toThrow();
    expect(() =>
      validateCourseMaster({
        ...courseMaster,
        courses: [{ ...first, department: "xx" }],
      }),
    ).toThrow();
  });
});
