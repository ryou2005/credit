import { describe, expect, it } from "vitest";
import { courseMaster, official } from "../src/data/registry";
import { evaluateCurriculum } from "../src/domain/engine";
import type { Grade } from "../src/domain/schema";

const offering = (name: string, department: string) =>
  courseMaster.courses.find(
    (x) => x.name === name && x.department === department,
  )!;
let n = 0;
// A passed course listed under the PDF's 他学科 heading.
const other = (
  name: string,
  department: string,
  patch: Partial<Grade> = {},
) => {
  const x = offering(name, department);
  return {
    id: `x${n++}`,
    courseId: "",
    masterId: x.id,
    otherDepartment: true,
    name,
    code: "",
    credits: x.credits,
    evaluation: "B",
    year: "2026",
    status: "earned",
    confirmed: true,
    provenance: { kind: "pdf", page: 4, raw: name },
    ...patch,
  } satisfies Grade;
};
const run = (grades: Grade[]) =>
  evaluateCurriculum(official, grades, { master: courseMaster });
const special = (r: ReturnType<typeof run>) =>
  r.results.find((x) => x.id.endsWith("-special"))!;

describe("他学科の科目を学部枠（p4注1）として判定に算入する", () => {
  it("第Ⅱ群b・第Ⅲ群の他学科科目は、専門71単位と合計に選択扱いで入る", () => {
    const r = run([
      other("デジタル信号処理", "id"),
      other("デジタル信号処理演習", "id"),
    ]);
    expect(r.issues).toEqual([]);
    expect(r.earned).toBe(300);
    expect(special(r).earned).toBe(300);
    // 選択必修・必修の条件には入らない
    const selective = r.results.find((x) => x.id.endsWith("-selective"))!;
    expect(selective.earned).toBe(0);
    expect(r.caps[0].actual).toBe(300);
  });

  it("学部枠は最大6単位まで", () => {
    const r = run([
      other("デジタル信号処理", "id"),
      other("デジタル信号処理演習", "id"),
      other("CG数学", "id"),
      other("コンピュータグラフィックス", "id"),
      other("ネットワークセキュリティ", "ic"),
    ]);
    expect(r.caps[0].actual).toBe(900);
    expect(special(r).earned).toBe(600);
    expect(r.earned).toBe(600);
  });

  it("類似科目（情報科学科の機械学習など）は算入しない", () => {
    const r = run([other("機械学習", "is"), other("数値計算法", "ic")]);
    expect(r.earned).toBe(0);
    expect(r.issues).toEqual([]);
    expect(r.notes.join()).toContain("類似科目");
  });

  it("同じ他学科科目を2回修得しても1回分", () => {
    const r = run([
      other("デジタル信号処理", "id"),
      other("デジタル信号処理", "id"),
    ]);
    expect(r.earned).toBe(200);
  });

  it("開講学科を特定できない他学科科目は要確認", () => {
    const r = run([other("デジタル信号処理", "id", { masterId: "" })]);
    expect(r.earned).toBe(0);
    expect(r.issues[0]).toContain("開講学科");
    expect(r.status).toBe("review");
  });

  it("単位数がマスターと違う他学科科目は要確認", () => {
    const r = run([other("デジタル信号処理", "id", { credits: "3" })]);
    expect(r.earned).toBe(0);
    expect(r.issues[0]).toContain("単位数");
  });

  it("マスターを渡さない場合は従来どおり要確認（自動算入しない）", () => {
    const r = evaluateCurriculum(official, [other("デジタル信号処理", "id")]);
    expect(r.earned).toBe(0);
    expect(r.status).toBe("review");
  });
});
