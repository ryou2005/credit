import { expect, it } from "vitest";
import { selectManualCurriculum } from "../src/data/registry";
it("年度・学部学科を明示入力し、未対応に切り替えない", () => {
  expect(
    selectManualCurriculum("２０２４", " 情報学部 ", "コンピュータ科学科")
      ?.entryYear,
  ).toBe(2024);
  expect(
    selectManualCurriculum("2025", "情報学部", "コンピュータ科学科"),
  ).toBeUndefined();
  expect(
    selectManualCurriculum("2024", "工学部", "コンピュータ科学科"),
  ).toBeUndefined();
  expect(
    selectManualCurriculum("2024", "情報学部", "情報デザイン学科"),
  ).toBeUndefined();
  expect(selectManualCurriculum("", "", "")).toBeUndefined();
});
