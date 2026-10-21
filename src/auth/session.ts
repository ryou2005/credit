import {
  createRemoteJWKSet,
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
  if (!authReady(config) || !nonce) throw new Error("認証設定が不正です。");
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: config.clientId,
    requiredClaims: ["exp", "iat", "sub", "nonce"],
    maxTokenAge: "10 minutes",
  });
  if (
    payload.nonce !== nonce ||
    !payload.sub ||
    (payload.azp && payload.azp !== config.clientId) ||
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
    throw new Error("Googleアカウントの確認に失敗しました。");
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
    options: { theme: string; size: string; locale: string; width: number },
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
  failure: () => void,
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
            .catch(() => {
              if (active) {
                consumed = false;
                failure();
              }
            });
        },
      });
      google.renderButton(element, {
        theme: "outline",
        size: "large",
        locale: "ja",
        width: 280,
      });
    })
    .catch(() => {
      if (active) failure();
    });
  return () => {
    active = false;
    element.replaceChildren();
  };
}
export async function logout() {
  window.google?.accounts.id.disableAutoSelect();
}
export const canUseDemo = (dev: boolean, hostname: string) =>
  dev && ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
