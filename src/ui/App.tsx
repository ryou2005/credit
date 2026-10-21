import { useEffect, useRef, useState } from "react";
import {
  registry,
  courseMaster,
  parseStudentNumber,
  sectionLabels,
  selectManualCurriculum,
} from "../data/registry";
import { creditText, type Grade, type GradeStatus } from "../domain/schema";
import { evaluateCurriculum } from "../domain/engine";
import {
  isExcludedSimilar,
  lookupMaster,
  type MasterCourse,
} from "../domain/master";
import { identityIssue } from "../pdf/normalize";
import { GradeSummary } from "./GradeSummary";
import {
  authConfig,
  authReady,
  mountGoogleButton,
  logout,
} from "../auth/session";
const states = { met: "充足", unmet: "未充足", review: "要確認" };
const headlines = {
  met: "確認できた単位要件を充足",
  unmet: "単位要件に未充足あり",
  review: "要確認",
};
const groupLabels: Record<MasterCourse["group"], string> = {
  I: "第Ⅰ群",
  "II-a": "第Ⅱ群a",
  "II-b": "第Ⅱ群b",
  III: "第Ⅲ群",
  other: "その他",
};
const offering = (x: MasterCourse) =>
  `${courseMaster.departments[x.department]?.label ?? x.department}・${groupLabels[x.group]}・${x.credits}単位`;
type Result = ReturnType<typeof evaluateCurriculum>;
export default function App() {
  const [session, setSession] = useState<"none" | "local" | "demo">("none");
  const [step, setStep] = useState(0);
  const [student, setStudent] = useState("");
  const [entryYear, setEntryYear] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const selected = selectManualCurriculum(entryYear, faculty, department);
  const [applicable, setApplicable] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [pdfIds, setPdfIds] = useState<string[]>([]);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [discarded, setDiscarded] = useState<Grade[]>([]);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [authError, setAuthError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const googleBtn = useRef<HTMLDivElement>(null);
  const alive = useRef(0);
  // Login is required only once a real client ID is configured; dev/demo stay open.
  const authConfigured = authReady(authConfig);

  const c = selected ?? registry[0];
  const candidate = parseStudentNumber(student);
  const studentIssue =
    student.trim() &&
    (!candidate.supported || candidate.curriculumId !== selected?.id)
      ? "学籍番号と入力した所属を確認してください。"
      : null;
  const mismatch =
    studentIssue ||
    (student.trim() ? identityIssue(candidate.normalized, pdfIds) : null);
  const totalRule = c.rules.find((r) => r.id === c.totalRuleId);
  const totalMinimum =
    totalRule?.expression.type === "credits"
      ? totalRule.expression.minimum
      : "—";
  const demoAvailable =
    import.meta.env.DEV &&
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const invalidate = () => {
    setResult(null);
    setReviewed(false);
    setError("");
  };
  // Gate the app behind Google sign-in only when a client ID is configured.
  const showLoginGate = authConfigured && session !== "demo" && !authEmail;
  const onLogin = (email: string) => {
    const parsed = parseStudentNumber(email.split("@")[0] ?? "");
    setAuthEmail(email);
    setAuthError("");
    setSession("local");
    setStudent(parsed.normalized);
    if (parsed.supported) {
      setEntryYear(parsed.entryYear ?? "");
      setFaculty(parsed.facultyLabel ?? "");
      setDepartment(parsed.departmentLabel ?? "");
    }
    setApplicable(false);
    invalidate();
  };
  useEffect(() => {
    if (!showLoginGate || step !== 0 || !consent || !googleBtn.current) return;
    return mountGoogleButton(googleBtn.current, onLogin, () =>
      setAuthError(
        "Googleログインに失敗しました。学内アカウント（@g.kogakuin.jp）でログインし、ポップアップのブロックを解除してください。",
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLoginGate, step, consent]);
  const update = (id: string, patch: Partial<Grade>) => {
    invalidate();
    setGrades((gs) =>
      gs.map((g) =>
        g.id === id
          ? { ...g, ...patch, confirmed: patch.confirmed ?? false }
          : g,
      ),
    );
  };
  const selectCourse = (g: Grade, id: string) => {
    const course = c.courses.find((x) => x.id === id),
      p = c.placements.find((x) => x.courseId === id);
    update(g.id, {
      courseId: id,
      masterId: id,
      ...(course && p
        ? {
            name: course.name,
            code: course.officialCode ?? "",
            credits: p.credits,
            creditSource: "master",
          }
        : {}),
    });
  };
  // Another department's offering chosen by the student (ambiguous name).
  const selectOffering = (g: Grade, id: string) => {
    const x = courseMaster.courses.find((m) => m.id === id);
    update(g.id, {
      masterId: id,
      ...(x ? { credits: x.credits, creditSource: "master" } : {}),
    });
  };
  const add = () => {
    invalidate();
    setGrades((gs) => [
      ...gs,
      {
        id: crypto.randomUUID(),
        courseId: "",
        name: "",
        code: "",
        credits: "",
        evaluation: "",
        year: "",
        status: "unknown",
        confirmed: false,
        provenance: { kind: "manual", raw: "本人による手入力" },
      },
    ]);
    setStep(3);
  };
  const loadDemo = async (complete = false) => {
    if (!import.meta.env.DEV || !demoAvailable || session !== "demo") return;
    const { demoGrades } = await import("../data/demo");
    invalidate();
    setGrades(demoGrades(c, complete));
    setPdfIds([]);
    setPdfLoaded(false);
    setDiscarded([]);
    setStep(3);
  };
  const importPdf = async (file?: File) => {
    if (!file || busy) return;
    if (session === "demo") {
      setError(
        "デモモードは架空データ専用です。実際の成績PDFは取り込めません。",
      );
      return;
    }
    const generation = ++alive.current;
    setBusy(true);
    setError("");
    try {
      const { readPdf } = await import("../pdf/read");
      const parsed = await readPdf(file, c);
      if (generation !== alive.current) return;
      setGrades(parsed.grades);
      setPdfIds(parsed.identifiers);
      setPdfLoaded(true);
      setDiscarded([]);
      invalidate();
      setStep(3);
    } catch (e) {
      if (generation === alive.current)
        setError(e instanceof Error ? e.message : "読み取りに失敗しました。");
    } finally {
      if (generation === alive.current) setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const reset = async () => {
    if (!confirm("成績データと入力内容をすべて消去して、最初に戻りますか？"))
      return;
    alive.current++;
    setBusy(false);
    setGrades([]);
    setDiscarded([]);
    setPdfIds([]);
    setPdfLoaded(false);
    setResult(null);
    setStudent("");
    setEntryYear("");
    setFaculty("");
    setDepartment("");
    setApplicable(false);
    setReviewed(false);
    setSession("none");
    setStep(0);
    setError("");
    setAuthEmail(null);
    setConsent(false);
    setAuthError("");
    void logout();
  };
  const assess = () => {
    if (!selected || !applicable || mismatch || !reviewed) {
      setError(
        mismatch ?? "所属・適用カリキュラムと成績の確認を完了してください。",
      );
      return;
    }
    try {
      setResult(evaluateCurriculum(c, grades));
      setStep(4);
      setError("");
    } catch {
      setError(
        "ルールデータの検証に失敗しました。判定せず、管理者へ確認してください。",
      );
    }
  };
  const backToId = () => {
    setStep(0);
    setApplicable(false);
    setResult(null);
  };
  return (
    <div className="shell">
      <header>
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">c.</span>credit
          <span className="brand-sub">卒業要件チェック</span>
        </a>
        <div className="header-actions">
          <span className="tag">
            {session === "demo"
              ? "架空データのデモ"
              : authEmail
                ? `${authEmail} / 本人未確認`
                : session === "local"
                  ? "認証なし / 本人未確認"
                  : "工学院大学向け"}
          </span>
          {session !== "none" && (
            <button className="text-button" onClick={reset}>
              リセット
            </button>
          )}
        </div>
      </header>
      <main>
        <div className="eyebrow">ACADEMIC PROGRESS / CREDIT CHECK</div>
        <h1 ref={heading} tabIndex={-1}>
          {
            [
              "卒業までの道のりを、確かめる。",
              "あなたのカリキュラムを確認",
              "成績を取り込む",
              "読み取った成績を確認",
              "卒業要件チェックの結果",
            ][step]
          }
        </h1>
        <p className="lede">
          {c.label}。成績と履修要件を照合し、今の修得状況を整理します。
        </p>
        <ol className="steps" aria-label="操作の進捗">
          {["対象確認", "取り込み", "成績確認", "結果"].map((s, i) => (
            <li
              key={s}
              aria-current={
                (step === 0 ? 0 : step - 1) === i ? "step" : undefined
              }
              className={
                (step === 0 ? 0 : step - 1) === i
                  ? "active"
                  : (step === 0 ? 0 : step - 1) > i
                    ? "done"
                    : ""
              }
            >
              <span>{(step === 0 ? 0 : step - 1) > i ? "✓" : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <div className="privacy">
          <span>⌁</span>{" "}
          成績はこのブラウザのメモリ内だけで処理します。再読み込み・終了すると消えます。
          <strong>大学の正式な卒業判定ではありません。</strong>
        </div>
        {step === 0 && (
          <section className="panel narrow">
            {showLoginGate ? (
              <>
                <h2>学内Googleアカウントでログイン</h2>
                <p>
                  工学院大学の <strong>@g.kogakuin.jp</strong>{" "}
                  アカウントでログインしてください。メールアドレスの学籍番号から、入学年度・学部・学科を判定します。これは大学非公式のツールです。
                </p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  大学非公式のツールであること、成績は端末内だけで処理され外部へ送信・保存されないことを理解しました。
                </label>
                {authError && <p className="notice error">{authError}</p>}
                <div
                  ref={googleBtn}
                  className="google-btn"
                  style={consent ? undefined : { display: "none" }}
                />
                {!consent && (
                  <p className="small">
                    上の確認にチェックすると、ログインボタンが表示されます。
                  </p>
                )}
              </>
            ) : (
              <>
                <h2>入学年度・学部・学科を入力</h2>
                {authEmail ? (
                  <>
                    <p>
                      <strong>{authEmail}</strong>{" "}
                      でログイン中です。学籍番号から判定した所属を確認してください。
                    </p>
                    <dl className="id-summary">
                      <div>
                        <dt>学籍番号</dt>
                        <dd>{student || "—"}</dd>
                      </div>
                      <div>
                        <dt>入学年度</dt>
                        <dd>{entryYear || "—"}</dd>
                      </div>
                      <div>
                        <dt>学部・学科</dt>
                        <dd>
                          {faculty && department
                            ? `${faculty} ${department}`
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <p role="status">
                      {selected
                        ? selected.label
                        : "学籍番号から対応カリキュラムを判定できませんでした。別年度・別学科へは自動変更しません。"}
                    </p>
                    {studentIssue && (
                      <p className="notice error">{studentIssue}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      ログインは不要です。現在の対応範囲は{" "}
                      {registry.map((x) => x.label).join("、")} です。
                    </p>
                    <label>
                      入学年度
                      <input
                        value={entryYear}
                        inputMode="numeric"
                        placeholder="例：2024"
                        onChange={(e) => {
                          setEntryYear(e.target.value);
                          setApplicable(false);
                          invalidate();
                        }}
                      />
                    </label>
                    <label>
                      学部
                      <input
                        value={faculty}
                        placeholder="例：情報学部"
                        onChange={(e) => {
                          setFaculty(e.target.value);
                          setApplicable(false);
                          invalidate();
                        }}
                      />
                    </label>
                    <label>
                      学科
                      <input
                        value={department}
                        placeholder="例：コンピュータ科学科"
                        onChange={(e) => {
                          setDepartment(e.target.value);
                          setApplicable(false);
                          invalidate();
                        }}
                      />
                    </label>
                    <p role="status">
                      {selected
                        ? selected.label
                        : entryYear && faculty && department
                          ? "未対応の年度・学部学科です。別の条件へ自動変更しません。"
                          : "入学年度・学部・学科を入力してください。"}
                    </p>
                    <label>
                      学籍番号（任意）
                      <input
                        aria-label="学籍番号"
                        value={student}
                        autoComplete="off"
                        placeholder="PDF内の番号と照合したい場合に入力"
                        onChange={(e) => {
                          setStudent(e.target.value);
                          setApplicable(false);
                          invalidate();
                        }}
                      />
                    </label>
                    {studentIssue && (
                      <p className="notice error">{studentIssue}</p>
                    )}
                    <p className="small">
                      所属は自己申告です。学籍番号を省略するとPDFとの番号照合は行いません。ご自身の成績であることを確認してください。
                    </p>
                  </>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={applicable}
                    disabled={!selected || !!studentIssue}
                    onChange={(e) => setApplicable(e.target.checked)}
                  />
                  このカリキュラムが自分に適用されることを確認しました。編入・転学科・特例は教務窓口で確認します。
                </label>
                <button
                  className="primary"
                  disabled={!selected || !applicable || !!studentIssue}
                  onClick={() => {
                    setSession(session === "demo" ? "demo" : "local");
                    setStep(2);
                    setError("");
                  }}
                >
                  成績の取り込みへ →
                </button>
              </>
            )}
            {demoAvailable && (
              <div className="demo-box">
                <p>架空データだけで試す場合はこちら。</p>
                <button
                  onClick={() => {
                    setSession("demo");
                    setEntryYear(String(registry[0].entryYear));
                    setFaculty("情報学部");
                    setDepartment("コンピュータ科学科");
                    setStudent("");
                    setApplicable(false);
                  }}
                >
                  デモを始める
                </button>
              </div>
            )}
          </section>
        )}
        {step === 2 && (
          <section className="panel">
            <div className="section-head">
              <h2>Ku-portで保存した成績PDF</h2>
              <button className="text-button" onClick={backToId}>
                対象を変更
              </button>
            </div>
            <p>
              Ku-portの成績参照画面から、ご自身でPDF保存してください。自動ログイン・自動取得は行いません。
            </p>
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void importPdf(e.dataTransfer.files[0]);
              }}
            >
              <span className="file-symbol">↥</span>
              <h3>PDFをここにドロップ</h3>
              <p>文字を含むPDF・20MB以下</p>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                aria-label="成績PDF"
                onChange={(e) => void importPdf(e.target.files?.[0])}
                disabled={busy || session === "demo"}
              />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={busy || session === "demo"}
              >
                {busy ? "読み取り中…" : "PDFを選択する"}
              </button>
            </div>
            <p className="notice">
              実際のKu-port
              PDFは未検証です。初期版は文字行を確認候補として抽出します。科目・単位・修得状況を確認してから計算してください。
            </p>
            <div className="actions">
              <button onClick={add} disabled={busy}>
                手入力で始める
              </button>
              {session === "demo" && demoAvailable && (
                <>
                  <button onClick={() => loadDemo()}>
                    架空の成績を読み込む
                  </button>
                  <button onClick={() => loadDemo(true)}>
                    全条件充足のデモ
                  </button>
                </>
              )}
            </div>
          </section>
        )}
        {step === 3 && (
          <section className="panel review">
            <div className="section-head">
              <div>
                <h2>成績の確認・修正</h2>
                <p>
                  {grades.length}
                  件。原文と科目マスターを照合し、修得状況を選んで「確認済み」にしてください。
                </p>
              </div>
              <div className="actions">
                <button
                  onClick={() => {
                    setStep(2);
                    setError("");
                  }}
                >
                  取り込み直す
                </button>
                <button onClick={add}>＋ 科目を追加</button>
              </div>
            </div>
            {mismatch && (
              <div className="notice error" role="alert">
                {mismatch}
                <button onClick={backToId}>学籍番号を確認する</button>
              </div>
            )}
            {pdfLoaded && (!pdfIds.length || !student.trim()) && (
              <p className="notice">
                学籍番号の照合ができていません。本人の成績か、原本で確認してください。
              </p>
            )}
            <GradeSummary grades={grades} />
            <p className="small">
              不明な評価は「要確認」のまま残してください。修得済みへの変更は原本での確認が必要です。氏名など成績以外の行は「対象外の行として除く」で除外できます。
            </p>
            <div className="grade-list">
              {grades.map((g, index) => {
                const p = c.placements.find((x) => x.courseId === g.courseId);
                const m = courseMaster.courses.find((x) => x.id === g.masterId);
                const found = g.otherDepartment
                  ? lookupMaster(courseMaster, c, g.name, {
                      otherDepartment: true,
                    })
                  : undefined;
                const choice = !m ? found : undefined;
                // Equivalent offerings in several departments: name them all,
                // since the PDF cannot tell which one was taken.
                const offerings =
                  m &&
                  found &&
                  !found.needsChoice &&
                  found.candidates.length > 1
                    ? found.candidates
                    : m
                      ? [m]
                      : [];
                return (
                  <article className="grade-row" key={g.id}>
                    <div className="row-top">
                      <span className="row-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <strong>{g.name || "新しい科目"}</strong>
                      <span
                        className={
                          "badge " +
                          (g.confirmed && g.status !== "unknown" && p
                            ? "met"
                            : "review")
                        }
                      >
                        {g.confirmed && g.status !== "unknown" && p
                          ? "確認済み"
                          : "要確認"}
                      </span>
                    </div>
                    {g.otherDepartment && m && (
                      <p
                        className={
                          "master-info" +
                          (isExcludedSimilar(courseMaster, c, m) ? " warn" : "")
                        }
                      >
                        他学科の科目：{offerings.map(offering).join(" または ")}
                        {isExcludedSimilar(courseMaster, c, m)
                          ? " — 類似科目のため、学部枠として卒業単位に算入できません（公式PDF p4 注1）"
                          : " — 学部枠（最大6単位・選択扱い）の対象"}
                      </p>
                    )}
                    {choice?.needsChoice && (
                      <label className="master-info warn">
                        同じ名前の科目が複数の学科にあります。開講学科を選んでください。
                        <select
                          aria-label={`開講学科 ${index + 1}`}
                          value=""
                          onChange={(e) => selectOffering(g, e.target.value)}
                        >
                          <option value="">選択してください</option>
                          {choice.candidates.map((x) => (
                            <option key={x.id} value={x.id}>
                              {offering(x)}
                              {isExcludedSimilar(courseMaster, c, x)
                                ? "（類似科目・算入不可）"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {g.otherDepartment && !m && !choice?.candidates.length && (
                      <p className="master-info warn">
                        他学科の科目ですが、科目マスター（情報学部4学科の第Ⅱ群b・第Ⅲ群）に見つかりません。
                      </p>
                    )}
                    {!g.credits.trim() && (
                      <p className="master-info warn">
                        単位数が分かりません。シラバス等で確認して入力してください。
                      </p>
                    )}
                    <div className="grade-fields">
                      <label className="course-field">
                        科目マスターとの対応
                        <select
                          aria-label={`科目 ${index + 1}`}
                          value={g.courseId}
                          onChange={(e) => selectCourse(g, e.target.value)}
                        >
                          <option value="">未分類・未知の科目</option>
                          {c.courses.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}（
                              {sectionLabels[
                                c.placements.find((p) => p.courseId === x.id)
                                  ?.section ?? ""
                              ] ?? "その他"}
                              ）
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        科目名
                        <input
                          aria-label={`科目名 ${index + 1}`}
                          value={g.name}
                          onChange={(e) =>
                            update(g.id, {
                              name: e.target.value,
                              courseId: "",
                              masterId: "",
                            })
                          }
                        />
                      </label>
                      <label>
                        科目コード
                        <input
                          value={g.code}
                          onChange={(e) =>
                            update(g.id, { code: e.target.value, courseId: "" })
                          }
                        />
                      </label>
                      <label>
                        単位
                        {g.creditSource === "master" && "（マスターで補完）"}
                        <input
                          aria-label={`単位 ${index + 1}`}
                          inputMode="decimal"
                          value={g.credits}
                          onChange={(e) =>
                            update(g.id, {
                              credits: e.target.value,
                              creditSource: "user",
                            })
                          }
                        />
                      </label>
                      <label>
                        評価（原記号）
                        <input
                          aria-label={`評価 ${index + 1}`}
                          value={g.evaluation}
                          onChange={(e) =>
                            update(g.id, {
                              evaluation: e.target.value,
                              status: "unknown",
                            })
                          }
                        />
                      </label>
                      <label>
                        修得年度
                        <input
                          value={g.year}
                          onChange={(e) =>
                            update(g.id, { year: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        本人確認した修得状況
                        <select
                          aria-label={`修得状況 ${index + 1}`}
                          value={g.status}
                          onChange={(e) =>
                            update(g.id, {
                              status: e.target.value as GradeStatus,
                            })
                          }
                        >
                          <option value="unknown">要確認</option>
                          <option value="earned">修得済み</option>
                          <option value="failed">不合格</option>
                          <option value="enrolled">履修中</option>
                          <option value="ungraded">未評価</option>
                        </select>
                      </label>
                    </div>
                    <div className="row-footer">
                      <label className="check">
                        <input
                          aria-label={`確認済み ${index + 1}`}
                          type="checkbox"
                          checked={g.confirmed}
                          onChange={(e) =>
                            update(g.id, { confirmed: e.target.checked })
                          }
                        />
                        原本と照合して確認済み
                      </label>
                      <button
                        className="text-button"
                        onClick={() => {
                          invalidate();
                          setDiscarded((ds) => [...ds, g]);
                          setGrades((gs) => gs.filter((x) => x.id !== g.id));
                        }}
                      >
                        対象外の行として除く
                      </button>
                    </div>
                    <details>
                      <summary>原文・出典と分類</summary>
                      <p>
                        {g.provenance.kind === "pdf"
                          ? `PDF ${g.provenance.page}ページ`
                          : g.provenance.kind === "demo"
                            ? "架空データ"
                            : "手入力"}{" "}
                        /{" "}
                        {p
                          ? `${sectionLabels[p.section] ?? p.section}・${p.kind === "required" ? "必修" : p.kind === "selective" ? "選択必修" : p.kind === "excluded" ? "算入対象外" : "選択"}`
                          : "分類未確認"}
                      </p>
                      <pre>{g.provenance.raw}</pre>
                    </details>
                  </article>
                );
              })}
            </div>
            {!!discarded.length && (
              <details>
                <summary>
                  本人が除外した行：{discarded.length}件（復元できます）
                </summary>
                {discarded.map((g) => (
                  <p key={g.id}>
                    {g.name}
                    <button
                      onClick={() => {
                        invalidate();
                        setGrades((gs) => [...gs, g]);
                        setDiscarded((ds) => ds.filter((x) => x.id !== g.id));
                      }}
                    >
                      復元
                    </button>
                  </p>
                ))}
              </details>
            )}
            <div className="review-confirm">
              <label className="check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                成績一覧・修得状況・除外した行を確認しました。不明な項目は「要確認」のまま判定します。
              </label>
              <button
                className="primary"
                onClick={assess}
                disabled={!reviewed || !!mismatch || !grades.length}
              >
                卒業要件をチェック →
              </button>
            </div>
          </section>
        )}
        {step === 4 && result && (
          <>
            <section className={"result-hero " + result.status}>
              <div>
                <span className="eyebrow">YOUR PROGRESS</span>
                <h2>{headlines[result.status]}</h2>
                <p>
                  確認済みの修得データに基づく結果です。
                  {result.status === "review"
                    ? "未確認の項目は算入していません。"
                    : ""}
                </p>
                <span className="badge">
                  {session === "demo"
                    ? "架空データの結果"
                    : "本人による入力確認"}{" "}
                  / 本人対応未確認
                </span>
              </div>
              <div className="total">
                <strong>{creditText(result.earned)}</strong>
                <span>算入単位</span>
                <small>必要 {totalMinimum} 単位</small>
              </div>
            </section>
            <div className="actions no-print">
              <button
                onClick={() => {
                  setStep(3);
                  setResult(null);
                }}
              >
                成績を修正して再計算
              </button>
              <button className="primary" onClick={() => window.print()}>
                印刷・PDF保存
              </button>
            </div>
            <GradeSummary grades={grades} />
            <p className="small">
              不足単位は条件ごとに重なります。各条件の不足を合算して、卒業までの不足総単位数にはできません。
            </p>
            <div className="result-grid">
              {result.results.map((r) => (
                <article className="panel rule" key={r.id}>
                  <div className="section-head">
                    <h3>{r.label}</h3>
                    <span className={"badge " + r.status}>
                      {states[r.status]}
                    </span>
                  </div>
                  {r.earned !== undefined && r.required !== undefined && (
                    <>
                      <div className="rule-value">
                        {r.metric === "courses"
                          ? r.earned
                          : creditText(r.earned)}
                        <small>
                          {" "}
                          /{" "}
                          {r.metric === "courses"
                            ? r.required
                            : creditText(r.required)}{" "}
                          {r.metric === "courses" ? "科目" : "単位"}
                        </small>
                      </div>
                      <progress
                        value={Math.min(r.earned, r.required)}
                        max={r.required || 1}
                      />
                      <p>
                        {r.missing
                          ? `確認済みデータで不足 ${r.metric === "courses" ? r.missing : creditText(r.missing)} ${r.metric === "courses" ? "科目" : "単位"}`
                          : "必要量を確認できました"}
                      </p>
                    </>
                  )}
                  {r.missingCourses && (
                    <>
                      <p>
                        {r.missingCourses.length
                          ? "未修得・修得未確認の必修科目"
                          : "必修科目をすべて確認しました"}
                      </p>
                      <ul>
                        {r.missingCourses.map((id) => (
                          <li key={id}>
                            {c.courses.find((x) => x.id === id)?.name ?? id}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="small">{r.reason}</p>
                  <a
                    href={r.source.url + `#page=${r.source.pages[0]}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    根拠：公式PDF {r.source.pages.join("・")}ページ ↗
                  </a>
                </article>
              ))}
            </div>
            <section className="panel">
              <h2>確認事項と算入の内訳</h2>
              {result.issues.length ? (
                <ul>
                  {result.issues.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p>入力データの未確認項目はありません。</p>
              )}
              {result.caps.map((cap) => (
                <p key={cap.id}>
                  他学科枠：算入前 {creditText(cap.actual)} 単位 / 上限{" "}
                  {creditText(cap.maximum)} 単位
                </p>
              ))}
              <details>
                <summary>
                  重複・未修得・算入対象外の処理（{result.notes.length}件）
                </summary>
                <ul>
                  {result.notes.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </details>
              <h3>成績以外に確認が必要な条件</h3>
              <ul>
                {c.externalConditions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <h3>未検証・未確定の事項</h3>
              <ul>
                {c.unresolved.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p className="small">
                適用：{c.label} / {c.id} / v{c.version}
                <br />
                根拠確認日：{c.source.checkedAt} / 学籍番号の本人対応は未確認
              </p>
            </section>
          </>
        )}
        <footer>
          <span>credit / 学生のための卒業要件チェック</span>
          <a href={c.source.url} target="_blank" rel="noreferrer">
            {c.entryYear}年度入学生用・公式資料 ↗
          </a>
          <span>学校非公式 / 成績の永続保存なし</span>
        </footer>
      </main>
    </div>
  );
}
