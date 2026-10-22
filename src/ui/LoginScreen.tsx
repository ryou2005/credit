import { useEffect, useRef, useState } from "react";
import { authConfig, authReady, mountGoogleButton } from "../auth/session";
import {
  Alert,
  Blob,
  Button,
  ProgressRing,
  Shape,
  StatNumber,
  StatusBadge,
  useEntered,
} from "./ds";

// 01 ログイン. Google sign-in is required; the decorative card shows sample values.
export function LoginScreen({
  onLogin,
  blocked,
  onLogout,
}: {
  onLogin: (email: string) => void;
  // Set after a sign-in whose student number is outside the supported range.
  blocked?: string;
  onLogout: () => void;
}) {
  const entered = useEntered();
  const [hover, setHover] = useState(false);
  const [ring, setRing] = useState(0);
  const [error, setError] = useState("");
  const slot = useRef<HTMLDivElement>(null);
  const configured = authReady(authConfig);
  useEffect(() => {
    const t = setTimeout(() => setRing(94), entered ? 1100 : 0);
    return () => clearTimeout(t);
  }, [entered]);
  useEffect(() => {
    if (!configured || blocked || !slot.current) return;
    return mountGoogleButton(
      slot.current,
      onLogin,
      () =>
        setError(
          "Googleログインに失敗しました。学内アカウント（@g.kogakuin.jp）でログインし、ポップアップのブロックを解除してください。",
        ),
      slot.current.clientWidth,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, blocked]);
  const rise = (delay: number) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? "none" : "translateY(28px)",
    transition: `opacity 900ms var(--ease-out) ${delay}ms, transform 900ms var(--ease-out) ${delay}ms`,
  });
  return (
    <div className="page login">
      <Shape
        entered={entered}
        hover={hover}
        delay={0}
        className="login-lilac"
        moved="translate(-36px, -30px) rotate(-14deg) scale(1.08)"
      >
        <Blob shape={2} color="lilac" size={240} rotate={18} />
      </Shape>
      <main className="login-grid">
        <section className="login-copy">
          <span className="eyebrow" style={rise(200)}>
            CREDIT CHECK
          </span>
          <h1>
            <span className="login-title" style={rise(320)}>
              <span className={"marker" + (entered ? " on" : "")}>
                あと何単位？
              </span>
            </span>
            <span className="login-sub" style={rise(460)}>
              が、すぐわかる。
            </span>
          </h1>
          <p className="login-lead" style={rise(600)}>
            成績PDFを読み込むだけで、必修・選択の進み具合を
            <br />
            卒業要件と自動で照合します。
          </p>
          <div className="login-action" style={rise(740)}>
            {!configured ? (
              <Alert tone="near" title="ログインの設定がありません">
                GoogleのクライアントID（VITE_GOOGLE_CLIENT_ID）を設定してください。
              </Alert>
            ) : blocked ? (
              <>
                <Alert tone="short" title="このアカウントは対象外です">
                  {blocked}
                </Alert>
                <Button variant="outline" iconLeft="log-out" onClick={onLogout}>
                  別のアカウントでログイン
                </Button>
              </>
            ) : (
              <>
                <div ref={slot} className="google-slot" />
                {error && <Alert tone="short">{error}</Alert>}
              </>
            )}
            <p className="muted">
              このサービスを利用するには、工学院のGmailアドレス（@g.kogakuin.jp）でのログインが必要です。
            </p>
          </div>
        </section>
        <aside
          className="login-art"
          aria-hidden="true"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="login-art-inner">
            <Shape
              entered={entered}
              hover={hover}
              delay={120}
              className="art-teal"
              moved="scale(1.05) rotate(8deg)"
            >
              <Blob shape={1} color="teal" size={580} />
            </Shape>
            <Shape
              entered={entered}
              hover={hover}
              delay={380}
              className="art-sun"
              moved="translate(-22px, 18px) rotate(-24deg)"
            >
              <Blob shape={3} color="sun" size={170} rotate={-20} />
            </Shape>
            <Shape
              entered={entered}
              hover={hover}
              delay={520}
              className="art-coral"
              moved="translate(18px, -22px) scale(1.2)"
            >
              <Blob shape={4} color="coral" size={80} />
            </Shape>
            <div
              className="art-card"
              style={{
                opacity: entered ? 1 : 0,
                transform: entered ? "none" : "translateY(56px) rotate(-6deg)",
                transition:
                  "opacity 900ms var(--ease-out) 700ms, transform 1000ms var(--ease-out) 700ms",
              }}
            >
              <div
                style={{
                  transform: hover ? "translateY(-10px)" : "rotate(-2deg)",
                  transition: "transform 600ms var(--ease-out)",
                }}
                className="art-card-body"
              >
                <div className="row-between">
                  <span className="label-strong">卒業要件の達成率</span>
                  <span className="eyebrow subtle">SAMPLE</span>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <ProgressRing value={ring} size={188} stroke={14}>
                    <StatNumber value="94" unit="%" size="md" align="center" />
                  </ProgressRing>
                </div>
                <div className="row-between dotted-top">
                  <span className="label-muted">取得単位</span>
                  <StatNumber value="116" total="124" unit="単位" size="sm" />
                </div>
              </div>
            </div>
            <div
              className="art-chip"
              style={{
                opacity: entered ? 1 : 0,
                transform: entered ? "none" : "translateY(-28px) rotate(6deg)",
                transition:
                  "opacity 800ms var(--ease-out) 960ms, transform 900ms var(--ease-out) 960ms",
              }}
            >
              <div
                style={{
                  transform: hover ? "translate(20px, -14px)" : "rotate(4deg)",
                  transition: "transform 600ms var(--ease-out)",
                }}
                className="art-chip-body"
              >
                <StatusBadge status="done" />
                <span className="chip-text">
                  <small>必修科目</small>
                  <span>すべて履修済み</span>
                </span>
              </div>
            </div>
            <div className="art-ink" style={rise(1100)}>
              <div
                style={{
                  transform: hover
                    ? "translate(-20px, 14px) rotate(-1deg)"
                    : "rotate(-4deg)",
                  transition: "transform 600ms var(--ease-out)",
                }}
                className="art-ink-body"
              >
                <small>選択科目</small>
                <span>
                  あと<b>8</b>単位
                </span>
              </div>
            </div>
          </div>
        </aside>
        <p
          className="login-disclaimer"
          style={{
            opacity: entered ? 1 : 0,
            transition: "opacity 900ms var(--ease-out) 1300ms",
          }}
        >
          本サービスは工学院大学の公式サービスではなく、学生が運営する非公式のツールです。
          <br />
          判定結果は目安のため、最終的な卒業要件の確認はご自身で行ってください。
          <br />
          成績PDFと成績はこの端末のブラウザ内だけで処理し、外部へ送信・保存しません。
        </p>
      </main>
    </div>
  );
}
