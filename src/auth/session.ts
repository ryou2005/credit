import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
export interface AuthConfig {
  clientId: string;
  allowedDomains: string[];
}
export const authConfig: AuthConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  allowedDomains: (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean),
};
export const authReady = (c: AuthConfig) =>
  /^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(c.clientId);
export function allowedIdentity(
  email: unknown,
  verified: unknown,
  domains: string[],
) {
  return (
    typeof email === "string" &&
    verified === true &&
    /^[^@\s]+@[^@\s]+$/.test(email) &&
    (!domains.length || domains.includes(email.split("@")[1].toLowerCase()))
  );
}
// Why a sign-in failed, so the login screen can say what to do about it.
// load: the Google button could not load (blocker, in-app browser, offline).
// domain: not a verified account of an allowed domain.
// clock: the token's times do not fit this device's clock.
// verify: anything else (signature, audience, nonce, ...).
export type LoginFailure = "load" | "domain" | "clock" | "verify";
export class LoginError extends Error {
  constructor(
    readonly reason: LoginFailure,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LoginError";
  }
}
// Google's iat is its own clock; a device a few seconds behind would otherwise
// see the token as issued in the future and reject every sign-in.
export const CLOCK_TOLERANCE = "5 minutes";
const TIME_CLAIMS = new Set(["iat", "exp", "nbf"]);
const timeIssue = (e: unknown) =>
  e instanceof errors.JWTExpired ||
  (e instanceof errors.JWTClaimValidationFailed && TIME_CLAIMS.has(e.claim));
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
// Verify locally; never send credentials to tokeninfo/debug services.
export async function verifyCredential(
  token: string,
  nonce: string,
  config = authConfig,
  keys: JWTVerifyGetKey = googleKeys,
): Promise<JWTPayload> {
  if (!authReady(config) || !nonce)
    throw new LoginError("verify", "認証設定が不正です。");
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256"],
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: config.clientId,
      requiredClaims: ["exp", "iat", "sub", "nonce"],
      maxTokenAge: "10 minutes",
      clockTolerance: CLOCK_TOLERANCE,
    }));
  } catch (e) {
    throw new LoginError(
      timeIssue(e) ? "clock" : "verify",
      "Googleアカウントの確認に失敗しました。",
      { cause: e },
    );
  }
  if (
    payload.nonce !== nonce ||
    !payload.sub ||
    (payload.azp && payload.azp !== config.clientId)
  )
    throw new LoginError("verify", "Googleアカウントの確認に失敗しました。");
  if (
    // Workspace hosted-domain claim must match the allowlist when both are present.
    (config.allowedDomains.length &&
      typeof payload.hd === "string" &&
      !config.allowedDomains.includes(payload.hd.toLowerCase())) ||
    !allowedIdentity(
      payload.email,
      payload.email_verified,
      config.allowedDomains,
    )
  )
    // Domains and flags only, never the address itself, so the console says
    // which check failed without exposing who tried.
    throw new LoginError(
      "domain",
      `対象のドメインのアカウントではありません。(hd=${String(payload.hd ?? "なし")}, email domain=${
        typeof payload.email === "string"
          ? (payload.email.split("@")[1] ?? "不明")
          : "なし"
      }, email_verified=${String(payload.email_verified)}, allowed=${config.allowedDomains.join(",")})`,
    );
  return payload;
}
interface GoogleId {
  initialize(options: {
    client_id: string;
    nonce: string;
    auto_select: boolean;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      theme: string;
      size: string;
      shape: string;
      text: string;
      logo_alignment: string;
      locale: string;
      width: number;
    },
  ): void;
  disableAutoSelect(): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}
let sdk: Promise<GoogleId> | undefined;
function loadGoogle() {
  if (window.google?.accounts.id)
    return Promise.resolve(window.google.accounts.id);
  return (sdk ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail(), 15000);
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      sdk = undefined;
      reject(new Error("Googleログインを読み込めません。"));
    };
    script.src = "https://accounts.google.com/gsi/client?hl=ja";
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      window.google?.accounts.id ? resolve(window.google.accounts.id) : fail();
    };
    script.onerror = fail;
    document.head.append(script);
  }));
}
export function mountGoogleButton(
  element: HTMLElement,
  success: (email: string) => void,
  failure: (reason: LoginFailure) => void,
  width = 280,
) {
  let active = true,
    consumed = false;
  const nonce = crypto.randomUUID();
  void loadGoogle()
    .then((google) => {
      if (!active) return;
      google.initialize({
        client_id: authConfig.clientId,
        nonce,
        auto_select: false,
        callback: (response) => {
          if (!active || consumed) return;
          consumed = true;
          void verifyCredential(response.credential, nonce)
            .then((payload) => {
              if (active) success(String(payload.email ?? ""));
            })
            .catch((e: unknown) => {
              const reason = e instanceof LoginError ? e.reason : "verify";
              // Reason only; the token and its claims are never logged.
              console.warn("[login]", reason, errorText(e));
              if (active) {
                consumed = false;
                failure(reason);
              }
            });
        },
      });
      // Official button, shaped toward the design's pill (Google caps width at 400).
      google.renderButton(element, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        logo_alignment: "center",
        locale: "ja",
        width: Math.min(400, Math.max(200, Math.round(width))),
      });
    })
    .catch((e: unknown) => {
      console.warn("[login]", "load", errorText(e));
      if (active) failure("load");
    });
  return () => {
    active = false;
    element.replaceChildren();
  };
}
const errorText = (e: unknown) => {
  const cause = e instanceof Error ? e.cause : undefined;
  return cause instanceof Error
    ? `${cause.name}: ${cause.message}`
    : String(e instanceof Error ? e.message : e);
};
export async function logout() {
  window.google?.accounts.id.disableAutoSelect();
}
