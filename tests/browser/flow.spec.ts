import { pdf } from "./pdf-fixture";
import { test, expect, type Page } from "@playwright/test";
async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "デモを始める" }).click();
  await page.getByLabel("学籍番号", { exact: true }).fill(" ｊ１２４０００ ");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "成績の取り込みへ" }).click();
}
// From the correction screen back to the result.
async function calculate(page: Page) {
  await page.getByRole("button", { name: "結果を更新する" }).click();
}

test("架空データの入力・修正・再計算・印刷・リセット", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  // No confirmation screen: the result appears right after loading grades.
  await page.getByRole("button", { name: "全条件充足のデモ" }).click();
  await expect(
    page.getByRole("heading", { name: "確認できた単位要件を充足" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /成績を修正する/ }).click();
  await page
    .getByRole("combobox", { name: "修得状況 1", exact: true })
    .selectOption("unknown");
  await calculate(page);
  await expect(
    page.getByRole("heading", { name: "要確認", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", { name: "卒業要件チェックの結果" }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "リセット", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "入学年度・学部・学科を入力" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("単位の集計：落単を数え、結果画面にも表示する", async ({ page }) => {
  await enter(page);
  await page.getByRole("button", { name: "全条件充足のデモ" }).click();
  const summary = page.getByRole("region", { name: "単位の集計" });
  await expect(summary).toBeVisible();
  await expect(summary.getByText("落単している科目")).toHaveCount(0);
  await page.getByRole("button", { name: /成績を修正する/ }).click();
  await page
    .getByRole("combobox", { name: "修得状況 1", exact: true })
    .selectOption("failed");
  await calculate(page);
  await expect(summary.getByText("落単している科目")).toBeVisible();
  await expect(summary.getByText("1科目", { exact: true })).toBeVisible();
});
test("対象外番号とスマートフォン幅", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "デモを始める" }).click();
  await page.getByLabel("学籍番号", { exact: true }).fill("J125000");
  await expect(
    page.getByRole("button", { name: "成績の取り込みへ" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("手入力、未知評価、行の除外と復元", async ({ page }) => {
  await enter(page);
  await page.getByRole("button", { name: "手入力で始める" }).click();
  await page.getByLabel("科目名 1", { exact: true }).fill("架空の未知科目");
  await page.getByLabel("単位 1", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "対象外の行として除く" }).click();
  await page.getByText("本人が除外した行：1件").click();
  await page.getByRole("button", { name: "復元", exact: true }).click();
  await calculate(page);
  await expect(
    page.getByRole("heading", { name: "要確認", exact: true }),
  ).toBeVisible();
});
test("成績データをネットワーク送信・永続保存しない", async ({ page }) => {
  const outgoing: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") outgoing.push(r.url());
  });
  await enter(page);
  await page.getByRole("button", { name: "架空の成績を読み込む" }).click();
  await expect(
    page.getByRole("heading", { name: "卒業要件チェックの結果" }),
  ).toBeVisible();
  expect(outgoing).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "入学年度・学部・学科を入力" }),
  ).toBeVisible();
});
test("PDF文字抽出と破損・文字なしの復旧可能なエラー", async ({ page }) => {
  await page.goto("/");
  const outputs = await page.evaluate(
    async ([valid, empty]) => {
      const url = "/src/pdf/read.ts";
      const dataUrl = "/src/data/registry.ts";
      const { readPdf } = await import(url);
      const { official } = await import(dataUrl);
      const result = await readPdf(
        new File([valid], "synthetic.pdf", { type: "application/pdf" }),
        official,
      );
      const failures = [];
      for (const input of [empty, "%PDF-corrupt"]) {
        try {
          await readPdf(
            new File([input], "synthetic.pdf", { type: "application/pdf" }),
            official,
          );
          failures.push("unexpected success");
        } catch (e) {
          failures.push((e as Error).message);
        }
      }
      return {
        raw: result.grades[0]?.provenance.raw,
        page: result.grades[0]?.provenance.page,
        failures,
      };
    },
    [pdf("Example course | | 1.5 | ZZ | 2025 | unknown"), pdf("")],
  );
  expect(outputs.raw).toContain("Example course");
  expect(outputs.page).toBe(1);
  expect(outputs.failures[0]).toContain("文字");
  expect(outputs.failures[1]).toContain("PDF");
  await enter(page);
  await page.getByRole("button", { name: "手入力で始める" }).click();
  await expect(page.getByRole("heading", { name: "成績の修正" })).toBeVisible();
});
