import { describe, it, expect } from "vitest";
import { official } from "../src/data/registry";
import { evaluateOutlook } from "../src/domain/outlook";
import { combinedShortfall, shortfallWithin } from "../src/domain/shortfall";
import type { Grade } from "../src/domain/schema";
import { syntheticGrades } from "./synthetic-grades";

const thesis = official.placements.find((p) => p.section === "thesis")!;
const special = official.rules.find((r) => r.id.endsWith("-special"))!;
const all = () => syntheticGrades(official);
const set = (gs: Grade[], courseId: string, status: Grade["status"]) =>
  gs.map((g) => (g.courseId === courseId ? { ...g, status } : g));
const credits = (courseId: string) =>
  Number(official.placements.find((p) => p.courseId === courseId)!.credits) *
  100;
// A 専門 required course other than the thesis.
const required = official.placements.find(
  (p) => p.section === "II-b" && p.kind === "required",
)!;

describe("履修中と卒論を取得する前提の見込み", () => {
  it("履修中の科目は、見込みでは取得済みとして数える", () => {
    const gs = set(all(), required.courseId, "enrolled");
    const o = evaluateOutlook(official, gs);
    expect(o.projected.earned - o.earned).toBe(credits(required.courseId));
    expect(o.projected.status).toBe("met");
    expect(
      o.projected.counted.find(
        (x) => x.placement.courseId === required.courseId,
      )?.enrolled,
    ).toBe(true);
    // The official reading is unchanged: the course is not passed yet.
    expect(o.status).toBe("unmet");
  });
  it("卒論が未登録なら、見込みでは取得する前提で数える", () => {
    const gs = all().filter((g) => g.courseId !== thesis.courseId);
    const o = evaluateOutlook(official, gs);
    expect(o.planned.earned - o.projected.earned).toBe(800);
    expect(combinedShortfall(official, o.planned.results)).toBe(0);
    // Without the assumption the 卒論 is still 8 credits short.
    expect(combinedShortfall(official, o.results)).toBe(800);
    expect(
      o.planned.counted.find((x) => x.placement.courseId === thesis.courseId)
        ?.assumed,
    ).toBe(true);
  });
  it("卒論が履修中なら、履修中として数え、二重に足さない", () => {
    const gs = set(all(), thesis.courseId, "enrolled");
    const o = evaluateOutlook(official, gs);
    expect(o.projected.earned - o.earned).toBe(800);
    expect(o.planned.earned).toBe(o.projected.earned);
  });
  it("見込みで数えられない履修中の行は、要確認を増やさない", () => {
    const unknown: Grade = {
      ...all()[0],
      id: "unknown",
      courseId: "",
      name: "架空の未知科目",
      status: "enrolled",
    };
    const o = evaluateOutlook(official, [...all(), unknown]);
    expect(o.issues).toEqual([]);
    expect(o.projected.issues).toEqual([]);
  });
});

describe("区分ごとの不足", () => {
  it("区分の中の必修科目の不足を、その区分の不足として数える", () => {
    const gs = all().filter((g) => g.courseId !== required.courseId);
    const o = evaluateOutlook(official, gs);
    if (special.expression.type !== "credits") throw new Error();
    expect(
      shortfallWithin(official, o.planned.results, special.expression.selector),
    ).toBe(credits(required.courseId));
  });
  it("ほかの区分の不足は含めない", () => {
    const lang = official.placements.find(
      (p) => p.section === "I-b" && p.kind === "required",
    )!;
    const gs = all().filter((g) => g.courseId !== lang.courseId);
    const o = evaluateOutlook(official, gs);
    if (special.expression.type !== "credits") throw new Error();
    expect(
      shortfallWithin(official, o.planned.results, special.expression.selector),
    ).toBe(0);
  });
});
