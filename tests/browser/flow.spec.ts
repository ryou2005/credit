import { pdf } from "./pdf-fixture";
import { AUTH_HOSTS, fakeGoogle, signIn } from "./google-fixture";
import { test, expect, type Page } from "@playwright/test";

// Chooses a synthetic PDF and presses 判定する.
async function judge(page: Page, text: string) {
  await page.getByLabel("成績PDF", { exact: true }).setInputFiles({
    name: "fictional.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf(text)),
  });
  await expect(page.getByText("fictional.pdf")).toBeVisible();
  await page.getByRole("button", { name: "判定する" }).click();
}
const title = (page: Page) => page.getByRole("heading", { level: 1 });

test("ログイン後は確認画面なしで取り込み画面へ進み、所属を表示する", async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByText("情報学部 コンピュータ科学科", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2024", { exact: true })).toBeVisible();
  await expect(page.getByText("j124000@g.kogakuin.jp")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "判定する" })).toBeDisabled();
});

test("判定・修正・再判定・卒論着手タブ・ログアウト", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  await judge(page, "Fictional course");
  // The unreadable line is left for review, so nothing counts yet.
  await expect(title(page)).toContainText("あと124単位");
  await expect(page.getByText("要確認", { exact: true }).first()).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "成績PDFを読み込み、判定しました" }),
  ).toBeVisible();
  await expect(page.getByText("成績PDF：fictional.pdf")).toBeVisible();

  await page.getByRole("button", { name: /成績を修正する/ }).click();
  await expect(page.getByRole("heading", { name: "成績の修正" })).toBeVisible();
  await page
    .getByRole("combobox", { name: "科目 1", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("combobox", { name: "修得状況 1", exact: true })
    .selectOption("earned");
  await page.getByRole("button", { name: "結果を更新する" }).click();
  await expect(title(page)).not.toContainText("あと124単位");
  await expect(title(page)).toContainText("卒業まで");
  await expect(page.getByText("卒業条件 未達成")).toBeVisible();

  await page.getByRole("tab", { name: "卒論着手条件" }).click();
  await expect(
    page.getByText(/卒業論文着手条件（総取得単位105単位以上）/),
  ).toBeVisible();
  await page.getByRole("button", { name: /総合文化科目/ }).click();
  await expect(page.getByText("必要単位", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page.getByText("あと何単位？")).toBeVisible();
  expect(errors).toEqual([]);
});

test("対象外の学籍番号はログイン画面で止める", async ({ page }) => {
  await fakeGoogle(page, "j125000@g.kogakuin.jp");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Googleでログイン（テスト）" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "このアカウントは対象外です",
  );
  await expect(
    page.getByRole("heading", { name: /成績PDFを\s*アップロード/ }),
  ).toHaveCount(0);
});

test("ドメイン外のアカウントはログインできない", async ({ page }) => {
  await fakeGoogle(page, "someone@example.com");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Googleでログイン（テスト）" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Googleログインに失敗しました",
  );
});

test("PDF内の学籍番号が違えば判定しない", async ({ page }) => {
  await signIn(page);
  await judge(page, "J124999 Fictional course");
  await expect(page.getByRole("alert")).toContainText(
    "ログイン中のアカウント（J124000）と一致しません",
  );
  await page.getByRole("button", { name: "別のPDFを選ぶ" }).click();
  await expect(page.getByText("成績PDFをここにドロップ")).toBeVisible();
});

test("修正画面：行の除外と復元", async ({ page }) => {
  await signIn(page);
  await judge(page, "Fictional course");
  await page.getByRole("button", { name: /成績を修正する/ }).click();
  await page.getByRole("button", { name: "＋ 科目を追加" }).click();
  await page.getByLabel("科目名 2", { exact: true }).fill("架空の未知科目");
  await page
    .getByRole("button", { name: "対象外の行として除く" })
    .first()
    .click();
  await page.getByText("本人が除外した行：1件").click();
  await page.getByRole("button", { name: "復元", exact: true }).click();
  await page.getByRole("button", { name: "結果を更新する" }).click();
  await expect(page.getByText("要確認", { exact: true }).first()).toBeVisible();
});

test("スマートフォン幅で横スクロールしない", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fits = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await fakeGoogle(page);
  await page.goto("/");
  expect(await fits()).toBe(true);
  await page
    .getByRole("button", { name: "Googleでログイン（テスト）" })
    .click();
  await expect(
    page.getByRole("heading", { name: /成績PDFを\s*アップロード/ }),
  ).toBeVisible();
  expect(await fits()).toBe(true);
  await judge(page, "Fictional course");
  await expect(title(page)).toContainText("卒業まで");
  expect(await fits()).toBe(true);
});

test("成績データを外部へ送信・永続保存しない", async ({ page }) => {
  const outgoing: string[] = [];
  page.on("request", (r) => {
    const url = r.url();
    const local =
      url.startsWith("http://127.0.0.1:5174") ||
      url.startsWith("blob:") ||
      url.startsWith("data:");
    if (
      r.method() !== "GET" ||
      (!local && !AUTH_HOSTS.some((h) => url.startsWith(h)))
    )
      outgoing.push(url);
  });
  await signIn(page);
  await judge(page, "Fictional course");
  await expect(title(page)).toContainText("卒業まで");
  expect(outgoing).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  await page.reload();
  await expect(page.getByText("あと何単位？")).toBeVisible();
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
});
