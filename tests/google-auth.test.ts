import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  authReady,
  allowedIdentity,
  LoginError,
  verifyCredential,
} from "../src/auth/session";
const config = {
  clientId: "123-test.apps.googleusercontent.com",
  allowedDomains: [],
};
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let keys: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  pair = await generateKeyPair("RS256");
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: "test", alg: "RS256" }],
  });
});
async function token(overrides = {}) {
  return new SignJWT({
    nonce: "expected",
    email: "fictional@example.test",
    email_verified: true,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer("https://accounts.google.com")
    .setAudience(config.clientId)
    .setSubject("fictional")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(pair.privateKey);
}
// Signs a token whose iat/exp are shifted, as seen from a device whose clock
// is `skew` seconds behind Google (positive) or ahead (negative).
async function skewed(skew: number) {
  const now = Math.floor(Date.now() / 1000) + skew;
  return new SignJWT({
    nonce: "expected",
    email: "fictional@example.test",
    email_verified: true,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer("https://accounts.google.com")
    .setAudience(config.clientId)
    .setSubject("fictional")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(pair.privateKey);
}
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof LoginError ? e.reason : "other"),
  );

describe("ログイン失敗の理由と端末の時計のずれ", () => {
  it.each([
    [2, "ok"],
    [60, "ok"],
    [-60, "ok"],
    [20 * 60, "clock"],
    [-20 * 60, "clock"],
    [-2 * 3600, "clock"],
  ])("端末の時計が %i 秒遅れている → %s", async (skew, expected) =>
    expect(
      await reason(
        verifyCredential(await skewed(skew), "expected", config, keys),
      ),
    ).toBe(expected),
  );
  it("ドメイン外・メール未確認は domain", async () => {
    expect(
      await reason(
        verifyCredential(
          await token(),
          "expected",
          { ...config, allowedDomains: ["school.test"] },
          keys,
        ),
      ),
    ).toBe("domain");
    expect(
      await reason(
        verifyCredential(
          await token({ email_verified: false }),
          "expected",
          config,
          keys,
        ),
      ),
    ).toBe("domain");
  });
  it("nonce不一致・別アプリ向けは verify", async () => {
    expect(
      await reason(verifyCredential(await token(), "different", config, keys)),
    ).toBe("verify");
    expect(
      await reason(
        verifyCredential(
          await token(),
          "expected",
          { ...config, clientId: "other.apps.googleusercontent.com" },
          keys,
        ),
      ),
    ).toBe("verify");
  });
});

describe("Google署名付き認証", () => {
  it("ドメイン制限なしのGoogleアカウント", async () => {
    expect(authReady(config)).toBe(true);
    expect(allowedIdentity("fictional@gmail.com", true, [])).toBe(true);
    await expect(
      verifyCredential(await token(), "expected", config, keys),
    ).resolves.toMatchObject({ email: "fictional@example.test" });
  });
  it("nonce不一致", async () => {
    await expect(
      verifyCredential(await token(), "different", config, keys),
    ).rejects.toThrow();
  });
  it("別アプリ向け", async () => {
    await expect(
      verifyCredential(
        await token(),
        "expected",
        { ...config, clientId: "other.apps.googleusercontent.com" },
        keys,
      ),
    ).rejects.toThrow();
  });
  it("メール未確認と任意のドメイン制限", async () => {
    await expect(
      verifyCredential(
        await token({ email_verified: false }),
        "expected",
        config,
        keys,
      ),
    ).rejects.toThrow();
    await expect(
      verifyCredential(
        await token(),
        "expected",
        { ...config, allowedDomains: ["school.test"] },
        keys,
      ),
    ).rejects.toThrow();
  });
  it("偽署名", async () => {
    const wrong = await generateKeyPair("RS256");
    const wrongKeys = createLocalJWKSet({
      keys: [
        { ...(await exportJWK(wrong.publicKey)), kid: "test", alg: "RS256" },
      ],
    });
    await expect(
      verifyCredential(await token(), "expected", config, wrongKeys),
    ).rejects.toThrow();
  });
  it("期限切れと不正発行者", async () => {
    for (const claims of [{ exp: 1 }, { iss: "https://evil.test" }]) {
      const signed = await new SignJWT({
        sub: "fictional",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        iss: "https://accounts.google.com",
        aud: config.clientId,
        nonce: "expected",
        email: "fictional@example.test",
        email_verified: true,
        ...claims,
      })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .sign(pair.privateKey);
      await expect(
        verifyCredential(signed, "expected", config, keys),
      ).rejects.toThrow();
    }
  });
});
