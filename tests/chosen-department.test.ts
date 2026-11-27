import { describe, expect, it } from "vitest";
import {
  loadChosenDepartment,
  saveChosenDepartment,
} from "../src/data/chosen-department";

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe("JXの学生が選んだ学科の保存", () => {
  it("学籍番号ごとに保存し、次回読み出す", () => {
    const s = memory();
    saveChosenDepartment("JX24001", "kogakuin-2024-is", s);
    expect(loadChosenDepartment("JX24001", ["kogakuin-2024-is"], s)).toBe(
      "kogakuin-2024-is",
    );
    expect(
      loadChosenDepartment("JX24002", ["kogakuin-2024-is"], s),
    ).toBeUndefined();
  });
  it("いま選べない学科が保存されていれば使わない", () => {
    const s = memory();
    saveChosenDepartment("JX24001", "withdrawn", s);
    expect(
      loadChosenDepartment("JX24001", ["kogakuin-2024-is"], s),
    ).toBeUndefined();
  });
  it("ブラウザの保存が使えなくても止まらない", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => saveChosenDepartment("JX24001", "x", broken)).not.toThrow();
    expect(loadChosenDepartment("JX24001", ["x"], broken)).toBeUndefined();
  });
});
