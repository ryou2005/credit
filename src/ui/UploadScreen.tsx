import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Blob,
  Button,
  FileDropzone,
  FileItem,
  Shape,
  useEntered,
} from "./ds";
import { TopBar } from "./TopBar";
import type { DepartmentChoice } from "../data/registry";

type Phase = "empty" | "selected" | "processing" | "error";
const sizeText = (n: number) =>
  n > 1048576
    ? (n / 1048576).toFixed(1) + " MB"
    : Math.max(1, Math.round(n / 1024)) + " KB";

// 02 PDFアップロード: choose a file, then 判定する reads and assesses it.
export function UploadScreen({
  email,
  department,
  entryYear,
  faculty,
  choices,
  chosen,
  onChoose,
  transferred,
  onLogout,
  onJudge,
}: {
  email: string;
  department: string;
  entryYear: number;
  faculty: string;
  // JX students (department not in the student number) pick from these.
  choices: DepartmentChoice[];
  chosen: string;
  onChoose: (curriculumId: string) => void;
  // 出席番号401以降（転籍・編入学）.
  transferred: boolean;
  onLogout: () => void;
  // Reads and assesses the file; resolves with the step that shows the result.
  onJudge: (file: File) => Promise<() => void>;
}) {
  const entered = useEntered();
  const [hover, setHover] = useState(false);
  const [phase, setPhase] = useState<Phase>("empty");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [fileError, setFileError] = useState("");
  const [readError, setReadError] = useState("");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearInterval), []);
  const pick = (f: File) => {
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (!isPdf) {
      setPhase("empty");
      setFile(null);
      setFileError(
        "PDF以外のファイルは読み取れません。Ku-portから出力した成績PDFを選んでください。",
      );
      return;
    }
    setFile(f);
    setFileError("");
    setPhase("selected");
  };
  const reset = () => {
    timers.current.forEach(clearInterval);
    setPhase("empty");
    setFile(null);
    setProgress(0);
    setReadError("");
  };
  const judge = async () => {
    if (!file || phase !== "selected" || needsDepartment) return;
    setPhase("processing");
    setProgress(0);
    // Reading has no byte-level progress; ease toward 90% until it finishes.
    const iv = window.setInterval(
      () => setProgress((p) => (p < 90 ? p + 3 : p)),
      90,
    );
    timers.current.push(iv);
    try {
      const show = await onJudge(file);
      clearInterval(iv);
      setProgress(100);
      timers.current.push(window.setTimeout(show, 350));
    } catch (e) {
      clearInterval(iv);
      setProgress(100);
      setReadError(e instanceof Error ? e.message : "読み取りに失敗しました。");
      setPhase("error");
    }
  };
  const busy = phase === "processing";
  const needsDepartment = choices.length > 0 && !chosen;
  const rise = (delay: number) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? "none" : "translateY(28px)",
    transition: `opacity 900ms var(--ease-out) ${delay}ms, transform 900ms var(--ease-out) ${delay}ms`,
  });
  const moving = hover || busy;
  return (
    <div className="page upload">
      <Shape
        entered={entered}
        hover={moving}
        delay={100}
        className="upload-sun"
        moved="translate(-24px, 22px) rotate(-14deg) scale(1.05)"
      >
        <Blob shape={3} color="sun" size={380} rotate={24} />
      </Shape>
      <Shape
        entered={entered}
        hover={moving}
        delay={0}
        className="upload-lilac"
        moved="translate(-26px, -22px) rotate(-12deg)"
      >
        <Blob shape={2} color="lilac" size={240} rotate={18} />
      </Shape>
      <Shape
        entered={entered}
        hover={moving}
        delay={420}
        className="upload-mint"
        moved="translate(18px, 18px) scale(1.25)"
      >
        <Blob shape={4} color="mint" size={90} />
      </Shape>
      <TopBar email={email} onLogout={onLogout} />
      <main className="upload-grid">
        <section className="upload-copy">
          <span className="eyebrow" style={rise(200)}>
            UPLOAD
          </span>
          <h1 style={rise(320)}>
            成績PDFを
            <br />
            アップロード
          </h1>
          <p className="lead-lg" style={rise(460)}>
            Ku-portから出力した成績PDFを選ぶだけ。卒業要件との照合は自動で行います。
          </p>
          <div className="account-info" style={rise(600)}>
            <span className="label-muted">
              Googleアカウントから確認した情報
            </span>
            <dl>
              <dt>学部・学科</dt>
              <dd>
                {choices.length ? (
                  <label className="dept-choice">
                    {faculty}
                    <select
                      aria-label="学科"
                      value={chosen}
                      disabled={busy}
                      onChange={(e) => onChoose(e.target.value)}
                    >
                      <option value="">学科を選択してください</option>
                      {choices.map((x) => (
                        <option key={x.curriculumId} value={x.curriculumId}>
                          {x.departmentLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  department
                )}
              </dd>
              <dt>入学年度</dt>
              <dd>
                <span className="num">{entryYear}</span>年度
              </dd>
            </dl>
            {choices.length > 0 && (
              <p className="account-note">
                学籍番号（JX）からは学科を判定できません。振り分けられた学科を選んでください。振り分け前の場合は、希望する学科の卒業要件で確認できます。
              </p>
            )}
            {transferred && (
              <p className="account-note warn">
                転籍・編入学の学籍番号（出席番号401以降）です。認定された単位や適用されるカリキュラムは、教務窓口で確認してください。
              </p>
            )}
          </div>
        </section>
        <section
          className="upload-panel"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            opacity: entered ? 1 : 0,
            transform: entered ? "none" : "translateY(40px)",
            transition:
              "opacity 900ms var(--ease-out) 520ms, transform 1000ms var(--ease-out) 520ms",
          }}
        >
          {phase === "empty" ? (
            <FileDropzone
              onFile={pick}
              error={fileError || undefined}
              description="またはボタンからファイルを選択してください（PDF形式・1ファイル）"
            />
          ) : (
            <div className="file-panel">
              <div className="row-between">
                <span className="file-title">
                  {phase === "processing"
                    ? "判定しています"
                    : phase === "error"
                      ? "読み取り結果を確認してください"
                      : "選択したファイル"}
                </span>
                {phase === "selected" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft="refresh-cw"
                    onClick={reset}
                  >
                    ファイルを変更
                  </Button>
                )}
              </div>
              <FileItem
                name={file?.name ?? ""}
                size={file ? sizeText(file.size) : ""}
                status={
                  phase === "processing"
                    ? "analyzing"
                    : phase === "error"
                      ? "error"
                      : "done"
                }
                progress={progress}
                message={
                  phase === "selected"
                    ? "選択済み"
                    : phase === "processing"
                      ? progress < 55
                        ? "成績を読み取り中"
                        : "卒業要件と照合中"
                      : phase === "error"
                        ? "要確認"
                        : undefined
                }
                onRemove={busy ? undefined : reset}
              />
              {phase === "selected" && (
                <p className="muted">
                  {needsDepartment
                    ? "左の「学部・学科」で学科を選ぶと判定できます。"
                    : "このファイルで判定します。内容を確認して「判定する」を押してください。"}
                </p>
              )}
              {busy && (
                <p className="muted">
                  成績を読み取り、卒業論文着手条件と卒業条件を照合しています。このままお待ちください。
                </p>
              )}
              {phase === "error" && (
                <>
                  <Alert
                    tone="near"
                    title="判定に必要な成績情報を読み取れませんでした"
                  >
                    {readError}
                  </Alert>
                  <div>
                    <Button
                      variant="outline"
                      iconLeft="folder-open"
                      onClick={reset}
                    >
                      別のPDFを選ぶ
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="judge-row">
            <Button
              size="lg"
              iconRight="arrow-right"
              disabled={phase !== "selected" || needsDepartment}
              loading={busy}
              onClick={() => void judge()}
            >
              {busy ? "判定しています…" : "判定する"}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
