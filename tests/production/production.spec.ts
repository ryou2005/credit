import { test, expect } from "@playwright/test";
test("公開ビルドは認証なしで開始する", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "入学年度・学部・学科を入力" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Googleでログイン" }),
  ).toHaveCount(0);
});
