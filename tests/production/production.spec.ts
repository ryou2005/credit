import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";
test("公開ビルドは認証なしで開始し、デモを表示しない", async ({ page }) => {
  await page.goto("/?demo=true&VITE_DEMO=true");
  await expect(
    page.getByRole("heading", { name: "入学年度・学部・学科を入力" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "デモを始める" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Googleでログイン" }),
  ).toHaveCount(0);
  expect(
    readdirSync("dist/assets").some((name) => name.startsWith("demo-")),
  ).toBe(false);
});
