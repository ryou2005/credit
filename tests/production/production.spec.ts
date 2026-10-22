import { test, expect } from "@playwright/test";
test("公開ビルドはGoogleログインから始まる", async ({ page }) => {
  await page.route("https://accounts.google.com/gsi/client*", (r) =>
    r.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.goto("/");
  await expect(page.getByText("あと何単位？")).toBeVisible();
  await expect(page.getByText("@g.kogakuin.jp").first()).toBeVisible();
  // No sign-in, no way past the login screen.
  await expect(page.getByLabel("成績PDF", { exact: true })).toHaveCount(0);
});
