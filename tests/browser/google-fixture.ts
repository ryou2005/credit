import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { expect, type Page } from "@playwright/test";

// Must match VITE_GOOGLE_CLIENT_ID in .env.e2e.
const CLIENT_ID = "123-e2e.apps.googleusercontent.com";
// Hosts the app may contact for sign-in; both are faked by this fixture.
export const AUTH_HOSTS = [
  "https://accounts.google.com/",
  "https://www.googleapis.com/",
];

// Serves a stand-in for Google Identity Services and Google's signing keys, so
// the app's real verification (signature, audience, nonce, domain) runs
// against a token signed by a test key. Nothing in the app is bypassed.
export async function fakeGoogle(page: Page, email = "j124000@g.kogakuin.jp") {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: "e2e",
    alg: "RS256",
    use: "sig",
  };
  await page.exposeFunction("__e2eSign", (nonce: string) =>
    new SignJWT({ nonce, email, email_verified: true, hd: email.split("@")[1] })
      .setProtectedHeader({ alg: "RS256", kid: "e2e" })
      .setIssuer("https://accounts.google.com")
      .setAudience(CLIENT_ID)
      .setSubject("e2e-" + email)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey),
  );
  await page.route("https://www.googleapis.com/oauth2/v3/certs", (r) =>
    r.fulfill({
      json: { keys: [jwk] },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route("https://accounts.google.com/gsi/client*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: `window.google = { accounts: { id: {
        initialize(o) { this.o = o; },
        renderButton(el) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = "Googleでログイン（テスト）";
          b.onclick = async () => this.o.callback({ credential: await window.__e2eSign(this.o.nonce) });
          el.replaceChildren(b);
        },
        disableAutoSelect() {},
      } } };`,
    }),
  );
}

// Signs in from the login screen and waits for the PDF upload screen.
export async function signIn(page: Page, email?: string) {
  await fakeGoogle(page, email);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Googleでログイン（テスト）" })
    .click();
  await expect(
    page.getByRole("heading", { name: /成績PDFを\s*アップロード/ }),
  ).toBeVisible();
}
