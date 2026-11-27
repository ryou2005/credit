import { pdf } from "./pdf-fixture";
import { AUTH_HOSTS, fakeGoogle, pressSignIn, signIn } from "./google-fixture";
import { test, expect, type Page } from "@playwright/test";

// Chooses a synthetic PDF; judging starts by itself.
async function judge(page: Page, text: string) {
  await page.getByLabel("成績PDF", { exact: true }).setInputFiles({
    name: "fictional.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf(text)),
  });
  await expect(page.getByText("fictional.pdf")).toBeVisible();
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
  // Read from the student number: no dialog, the usual label, nothing to change.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Googleアカウントから確認した情報"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "変更" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "判定する" })).toHaveCount(0);
});

test("ファイルを選ぶと自動で判定し、直後なら「ファイルを変更」で取り消せる", async ({
  page,
}) => {
  await signIn(page);
  const input = page.getByLabel("成績PDF", { exact: true });
  const file = {
    name: "fictional.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf("Fictional course")),
  };
  await input.setInputFiles(file);
  await expect(
    page.getByText("このファイルで判定を始めます。", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ファイルを変更" }).click();
  await page.waitForTimeout(900);
  await expect(page.getByLabel("成績PDF", { exact: true })).toBeAttached();
  await expect(page.getByText("判定しています")).toHaveCount(0);
  await input.setInputFiles(file);
  await expect(title(page)).toContainText("卒業まで");
});

test("他学科（情報科学科）は学籍番号から所属を決め、学科の区分名で表示する", async ({
  page,
}) => {
  await signIn(page, "j324000@g.kogakuin.jp");
  await expect(
    page.getByText("情報学部 情報科学科", { exact: true }),
  ).toBeVisible();
  await judge(page, "Fictional course");
  await expect(title(page)).toContainText("あと116単位");
  await page
    .locator("#requirements")
    .getByRole("button", { name: /専門基礎＋専門科目/ })
    .click();
  for (const area of ["経営情報", "情報インフラ", "データ科学"])
    await expect(
      page.getByText(`${area} 選択必修`, { exact: true }).first(),
    ).toBeVisible();
});

test("判定・修正・再判定・卒論着手タブ・ログアウト", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  await judge(page, "Fictional course");
  // The unreadable line is left for review, so nothing counts yet.
  await expect(title(page)).toContainText("あと116単位");
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
  await expect(title(page)).not.toContainText("あと116単位");
  await expect(title(page)).toContainText("卒業まで");
  await expect(page.getByText(/^不足 \d+(\.\d+)?単位$/)).toBeVisible();
  // 足りない単位 lists each 区分; a row jumps to that 区分 on the 卒業条件 tab.
  await expect(
    page.getByRole("heading", { name: "足りない単位" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /総合文化科目.*来期に履修/ }).click();
  await expect(page.getByText("必要単位", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "次にやること" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "卒論着手条件" }).click();
  await expect(
    page.getByText(/卒業論文着手条件（総取得単位105単位以上）/),
  ).toBeVisible();
  await page
    .locator("#requirements")
    .getByRole("button", { name: /総合文化科目/ })
    .click();
  await expect(page.getByText("必要単位", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page.getByText("あと何単位？")).toBeVisible();
  expect(errors).toEqual([]);
});

test("学籍番号JXはログイン直後のポップアップで学科を選び、選んだ学科で判定する", async ({
  page,
}) => {
  await pressSignIn(page, "jx24001@g.kogakuin.jp");
  const dialog = page.getByRole("dialog", { name: "学科を選んでください" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("情報学部");
  await expect(dialog).toContainText("2024年度");
  await expect(dialog).toContainText("jx24001@g.kogakuin.jp");
  const start = dialog.getByRole("button", { name: "判定をはじめる" });
  await expect(start).toBeDisabled();
  await expect(dialog.getByRole("radio")).toHaveCount(4);
  await dialog.getByRole("radio", { name: "情報科学科" }).check();
  await start.click();
  await expect(
    page.getByRole("heading", { name: /成績PDFを\s*アップロード/ }),
  ).toBeVisible();
  await expect(page.getByText("選択した所属")).toBeVisible();
  await expect(
    page.getByText("情報学部 情報科学科", { exact: true }),
  ).toBeVisible();
  await judge(page, "JX24001 Fictional course");
  await expect(title(page)).toContainText("あと116単位");
  await expect(
    page.getByText("情報学部 情報科学科（本人が選択）", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("PDF内の学籍番号を照合できませんでした"),
  ).toHaveCount(0);

  // The pick is kept in this browser: the next sign-in skips the dialog.
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page
    .getByRole("button", { name: "Googleでログイン（テスト）" })
    .click();
  await expect(
    page.getByRole("heading", { name: /成績PDFを\s*アップロード/ }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("情報学部 情報科学科", { exact: true }),
  ).toBeVisible();

  // 変更 reopens it with the current pick; a new pick replaces it.
  await page.getByRole("button", { name: "変更" }).click();
  await expect(dialog.getByRole("radio", { name: "情報科学科" })).toBeChecked();
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "変更" }).click();
  await dialog.getByRole("radio", { name: "情報デザイン学科" }).check();
  await dialog.getByRole("button", { name: "判定をはじめる" }).click();
  await expect(
    page.getByText("情報学部 情報デザイン学科", { exact: true }),
  ).toBeVisible();
});

test("学科選択のポップアップから「アカウントを変更」でログインに戻る", async ({
  page,
}) => {
  await pressSignIn(page, "jx24002@g.kogakuin.jp");
  const dialog = page.getByRole("dialog", { name: "学科を選んでください" });
  await dialog.getByRole("button", { name: "アカウントを変更" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Googleでログイン（テスト）" }),
  ).toBeVisible();
});

test("学科選択のポップアップはスマートフォン幅でも横にはみ出さない", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pressSignIn(page, "jx24003@g.kogakuin.jp");
  const dialog = page.getByRole("dialog", { name: "学科を選んでください" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
  await info.attach("dept-dialog-mobile", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("転籍・編入学の学籍番号（401以降）は教務窓口での確認を促す", async ({
  page,
}) => {
  await signIn(page, "j124401@g.kogakuin.jp");
  await expect(
    page.getByText("転籍・編入学の学籍番号（出席番号401以降）です", {
      exact: false,
    }),
  ).toBeVisible();
  await judge(page, "Fictional course");
  await expect(
    page.getByText(
      "転籍・編入学の学籍番号：認定単位などは教務窓口で確認してください",
    ),
  ).toBeVisible();
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
    "学内アカウントでログインしてください",
  );
});

test("Googleログインを読み込めないときは、ブロッカーやアプリ内ブラウザを案内する", async ({
  page,
}) => {
  await page.route("https://accounts.google.com/gsi/client*", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Googleログインを読み込めませんでした",
  );
  await expect(page.getByRole("alert")).toContainText("Braveのシールド");
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
