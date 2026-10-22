import { useEffect, useState } from "react";
import { registry, courseMaster, parseStudentNumber } from "../data/registry";
import type { Curriculum, Grade } from "../domain/schema";
import { evaluateCurriculum } from "../domain/engine";
import { identityIssue } from "../pdf/normalize";
import { logout } from "../auth/session";
import { LoginScreen } from "./LoginScreen";
import { UploadScreen } from "./UploadScreen";
import { ResultScreen, useToast } from "./ResultScreen";
import { EditorScreen, needsReview } from "./EditorScreen";

type Result = ReturnType<typeof evaluateCurriculum>;
type Step = "login" | "upload" | "editor" | "result";
interface Account {
  email: string;
  student: string;
  curriculum: Curriculum;
  department: string;
}

export default function App() {
  const [step, setStep] = useState<Step>("login");
  const [account, setAccount] = useState<Account | null>(null);
  const [blocked, setBlocked] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [discarded, setDiscarded] = useState<Grade[]>([]);
  // Rows needing review when the correction screen opened. Kept fixed so a row
  // does not vanish from the list the moment it is fixed.
  const [focusIds, setFocusIds] = useState<string[]>([]);
  const [pdfIds, setPdfIds] = useState<string[]>([]);
  const [pdfName, setPdfName] = useState("");
  const [judgedAt, setJudgedAt] = useState(new Date());
  const [result, setResult] = useState<Result | null>(null);
  const [toast, setToast] = useToast();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // The signed-in student number decides the curriculum; nothing is entered by hand.
  const onLogin = (email: string) => {
    const parsed = parseStudentNumber(email.split("@")[0] ?? "");
    const curriculum = registry.find((x) => x.id === parsed.curriculumId);
    if (!parsed.supported || !curriculum) {
      setBlocked(
        `${email} の学籍番号から、対応しているカリキュラムを判定できませんでした。現在の対応範囲は ${registry.map((x) => x.label).join("、")} です。別年度・別学科のルールへは切り替えません。`,
      );
      return;
    }
    setAccount({
      email,
      student: parsed.normalized,
      curriculum,
      department: `${parsed.facultyLabel} ${parsed.departmentLabel}`,
    });
    setStep("upload");
  };
  const signOut = () => {
    setAccount(null);
    setBlocked("");
    setGrades([]);
    setDiscarded([]);
    setPdfIds([]);
    setPdfName("");
    setResult(null);
    setToast("");
    setStep("login");
    void logout();
  };
  const evaluate = (c: Curriculum, gs: Grade[]) => {
    try {
      return evaluateCurriculum(c, gs, { master: courseMaster });
    } catch {
      throw new Error(
        "ルールデータの検証に失敗しました。判定せず、管理者へ確認してください。",
      );
    }
  };

  if (step === "login" || !account)
    return (
      <LoginScreen
        onLogin={onLogin}
        blocked={blocked || undefined}
        onLogout={signOut}
      />
    );
  const c = account.curriculum;

  // Reads the PDF, checks it is the signed-in student's, and assesses it.
  const judge = async (file: File) => {
    const { readPdf } = await import("../pdf/read");
    const parsed = await readPdf(file, c);
    if (identityIssue(account.student, parsed.identifiers))
      throw new Error(
        `PDF内の学籍番号が、ログイン中のアカウント（${account.student}）と一致しません。ご自身の成績PDFを選んでください。`,
      );
    if (!parsed.grades.length)
      throw new Error(
        "成績の行を見つけられませんでした。Ku-portの成績一覧表のPDFか確認してください。",
      );
    const gs = parsed.grades.map((g) => ({ ...g, confirmed: true }));
    const r = evaluate(c, gs);
    return () => {
      setGrades(gs);
      setDiscarded([]);
      setPdfIds(parsed.identifiers);
      setPdfName(file.name);
      setJudgedAt(new Date());
      setResult(r);
      setToast("成績PDFを読み込み、判定しました");
      setStep("result");
    };
  };

  if (step === "upload")
    return (
      <UploadScreen
        email={account.email}
        department={account.department}
        entryYear={c.entryYear}
        onLogout={signOut}
        onJudge={judge}
      />
    );
  if (step === "editor")
    return (
      <EditorScreen
        c={c}
        email={account.email}
        grades={grades}
        setGrades={setGrades}
        discarded={discarded}
        setDiscarded={setDiscarded}
        focusIds={focusIds}
        onLogout={signOut}
        onReupload={() => setStep("upload")}
        onSubmit={() => {
          setResult(evaluate(c, grades));
          setJudgedAt(new Date());
          setToast("成績を修正し、再判定しました");
          setStep("result");
        }}
      />
    );
  if (!result) return null;
  return (
    <ResultScreen
      c={c}
      result={result}
      email={account.email}
      department={account.department}
      pdfName={pdfName}
      judgedAt={judgedAt}
      unverifiedId={!pdfIds.length}
      toast={toast}
      onCloseToast={() => setToast("")}
      onLogout={signOut}
      onReupload={() => setStep("upload")}
      onEdit={() => {
        setFocusIds(grades.filter((g) => needsReview(c, g)).map((g) => g.id));
        setStep("editor");
      }}
    />
  );
}
