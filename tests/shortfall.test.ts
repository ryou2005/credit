import { describe, it, expect } from "vitest";
import { official } from "../src/data/registry";
import { evaluateCurriculum } from "../src/domain/engine";
import { combinedShortfall } from "../src/domain/shortfall";
import { syntheticGrades } from "./synthetic-grades";

const name = (n: string) => official.courses.find((x) => x.name === n)!.id;
const without = (...names: string[]) => {
  const ids = names.map(name);
  return syntheticGrades(official).filter((g) => !ids.includes(g.courseId));
};
const need = (gs = syntheticGrades(official)) => {
  const r = evaluateCurriculum(official, gs);
  return combinedShortfall(official, r.results);
};

describe("重なりを除いた不足単位", () => {
  it("すべて修得していれば0", () => {
    expect(need()).toBe(0);
  });
  it("卒論8単位の不足は合計の不足と重なるので8単位", () => {
    const gs = without("卒業論文(PBL)");
    const r = evaluateCurriculum(official, gs);
    const thesis = r.results.find((x) => x.label === "卒業論文")!;
    expect(thesis.missing).toBe(800);
    expect(need(gs)).toBe(800);
  });
  it("別々の区分の不足は足し合わせる", () => {
    // 外国語と共通基礎の必修を1科目ずつ欠く：区分が別なので不足は足し算。
    const lang = official.placements.find(
      (p) => p.section === "I-b" && p.kind === "required",
    )!;
    const common = official.placements.find(
      (p) => p.section === "II-a" && p.kind === "required",
    )!;
    const gs = syntheticGrades(official).filter(
      (g) => g.courseId !== lang.courseId && g.courseId !== common.courseId,
    );
    const expected = Number(lang.credits) * 100 + Number(common.credits) * 100;
    expect(need(gs)).toBe(expected);
  });
  it("卒論着手の条件でも計算できる", () => {
    const r = evaluateCurriculum(official, []);
    const total = r.thesisEntry.results.find(
      (x) =>
        x.expression.type === "credits" &&
        !Object.keys(x.expression.selector).length,
    )!;
    expect(
      combinedShortfall(official, r.thesisEntry.results),
    ).toBeGreaterThanOrEqual(total.missing!);
  });
});

describe("卒論着手条件（p4）", () => {
  it("全修得なら卒論着手も充足", () => {
    const r = evaluateCurriculum(official, syntheticGrades(official));
    expect(r.thesisEntry.status).toBe("met");
    expect(r.thesisEntry.results.length).toBeGreaterThan(0);
  });
  it("注2の実験・セミナーが欠けると未充足", () => {
    const r = evaluateCurriculum(official, without("情報学実験"));
    const named = r.thesisEntry.results.find((x) => x.label.includes("注2"))!;
    expect(named.status).toBe("unmet");
    expect(r.thesisEntry.status).toBe("unmet");
  });
  it("卒論がなくても着手条件は満たせる", () => {
    const r = evaluateCurriculum(official, without("卒業論文(PBL)"));
    expect(r.status).toBe("unmet");
    expect(r.thesisEntry.status).toBe("met");
  });
});
