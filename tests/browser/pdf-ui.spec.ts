import { pdf } from "./pdf-fixture";
import { test, expect } from "@playwright/test";
import { encryptedPdf } from "./encrypted-fixture";

test("認証なしの取り込み画面：暗号化・破損PDFから手入力へ復旧", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("入学年度", { exact: true }).fill("2024");
  await page.getByLabel("学部", { exact: true }).fill("情報学部");
  await page.getByLabel("学科", { exact: true }).fill("コンピュータ科学科");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "成績の取り込みへ" }).click();
  await page.getByLabel("成績PDF", { exact: true }).setInputFiles({
    name: "synthetic-encrypted.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(encryptedPdf, "base64"),
  });
  await expect(page.getByRole("alert")).toContainText("暗号化");
  await page.getByLabel("成績PDF", { exact: true }).setInputFiles({
    name: "synthetic-corrupt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-corrupt"),
  });
  await expect(page.getByRole("alert")).toContainText("PDF");
  await page.getByRole("button", { name: "手入力で始める" }).click();
  await expect(page.getByRole("heading", { name: "成績の修正" })).toBeVisible();
});

test("結果のスマートフォン表示と印刷PDF出力", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "デモを始める" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "成績の取り込みへ" }).click();
  await page.getByRole("button", { name: "架空の成績を読み込む" }).click();
  await expect(
    page.getByRole("heading", { name: "単位要件に未充足あり" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("mobile-result.png"),
    fullPage: true,
  });
  const bytes = await page.pdf({
    path: info.outputPath("synthetic-result.pdf"),
    format: "A4",
    printBackground: true,
  });
  expect(bytes.length).toBeGreaterThan(10000);
});

test("認証なしで対象を入力し文字PDFをアップロードする", async ({page}) => {
 const outbound: string[] = [];
 page.on("request",r => { if (!r.url().startsWith("http://127.0.0.1:5174") && !r.url().startsWith("blob:") && !r.url().startsWith("data:")) outbound.push(r.url()); });
 await page.goto("/");
 await page.getByLabel("入学年度",{exact:true}).fill("2025");
 await page.getByLabel("学部",{exact:true}).fill("情報学部");
 await page.getByLabel("学科",{exact:true}).fill("コンピュータ科学科");
 await expect(page.getByRole("button",{name:"成績の取り込みへ"})).toBeDisabled();
 await page.getByLabel("入学年度",{exact:true}).fill("2024");
 await page.getByRole("checkbox").check();
 await page.getByRole("button",{name:"成績の取り込みへ"}).click();
 await expect(page.getByLabel("成績PDF",{exact:true})).toBeEnabled();
 await page.getByLabel("成績PDF",{exact:true}).setInputFiles({name:"fictional.pdf",mimeType:"application/pdf",buffer:Buffer.from(pdf("Fictional course"))});
 // Straight to the result: the unreadable line is left for review.
 await expect(page.getByRole("heading",{name:"要確認",exact:true})).toBeVisible();
 await expect(page.getByText("学籍番号の照合ができていません。",{exact:false})).toBeVisible();
 expect(outbound).toEqual([]);
});
