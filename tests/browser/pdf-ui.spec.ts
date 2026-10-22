import { pdf } from "./pdf-fixture";
import { test, expect } from "@playwright/test";
import { encryptedPdf } from "./encrypted-fixture";
import { signIn } from "./google-fixture";

test("暗号化・破損PDFは理由を示し、別のPDFを選び直せる", async ({ page }) => {
  await signIn(page);
  const input = page.getByLabel("成績PDF", { exact: true });
  await input.setInputFiles({
    name: "synthetic-encrypted.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(encryptedPdf, "base64"),
  });
  await page.getByRole("button", { name: "判定する" }).click();
  await expect(page.getByRole("alert")).toContainText("暗号化");
  await page.getByRole("button", { name: "別のPDFを選ぶ" }).click();
  await input.setInputFiles({
    name: "synthetic-corrupt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-corrupt"),
  });
  await page.getByRole("button", { name: "判定する" }).click();
  await expect(page.getByRole("alert")).toContainText("PDF");
});

test("PDF以外のファイルは選べない", async ({ page }) => {
  await signIn(page);
  await page.getByLabel("成績PDF", { exact: true }).setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "PDF以外のファイルは読み取れません",
  );
  await expect(page.getByRole("button", { name: "判定する" })).toBeDisabled();
});

test("結果のスマートフォン表示", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByLabel("成績PDF", { exact: true }).setInputFiles({
    name: "fictional.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf("Fictional course")),
  });
  await page.getByRole("button", { name: "判定する" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "卒業まで",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("mobile-result.png"),
    fullPage: true,
  });
});
