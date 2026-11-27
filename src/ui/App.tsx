import { useEffect, useState } from "react";
import {
  registry,
  courseMaster,
  parseStudentNumber,
  type DepartmentChoice,
} from "../data/registry";
import type { Curriculum, Grade } from "../domain/schema";
import { evaluateOutlook, type Outlook } from "../domain/outlook";
import { identityIssue } from "../pdf/normalize";
import {
  loadChosenDepartment,
  saveChosenDepartment,
} from "../data/chosen-department";
import { DepartmentDialog } from "./DepartmentDialog";
import { logout } from "../auth/session";
import { LoginScreen } from "./LoginScreen";
import { UploadScreen } from "./UploadScreen";
import { ResultScreen, useToast } from "./ResultScreen";
import { EditorScreen, needsReview } from "./EditorScreen";

type Result = Outlook;
type Step = "login" | "department" | "upload" | "editor" | "result";
interface Account {
  email: string;
  student: string;
  // null until a JX student picks the department they were assigned to.
  curriculum: Curriculum | null;
  faculty: string;
  department: string;
  entryYear: number;
  // JX only: the departments the student can pick from.
  choices: DepartmentChoice[];
  // 出席番号401以降（転籍・編入学）.
  transferred: boolean;
}
// The account with a JX student's chosen department applied.
const withDepartment = (a: Account, curriculumId: string): Account => {
  const choice = a.choices.find((x) => x.curriculumId === curriculumId);
  return {
    ...a,
    curriculum: choice
      ? (registry.find((x) => x.id === curriculumId) ?? null)
      : null,
    department: choice ? `${a.faculty} ${choice.departmentLabel}` : "",
  };
};

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
  // The department dialog reopened from the upload screen (変更).
  const [deptOpen, setDeptOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // The signed-in student number decides the curriculum. Only a JX student
  // (department not in the number) picks the department, in a dialog right
  // after sign-in; the pick is kept in this browser for the next sign-in.
  const onLogin = (email: string) => {
    const parsed = parseStudentNumber(email.split("@")[0] ?? "");
    const curriculum =
      registry.find((x) => x.id === parsed.curriculumId) ?? null;
    if (!parsed.supported || (!curriculum && !parsed.choices.length)) {
      setBlocked(
        `${email} の学籍番号から、対応しているカリキュラムを判定できませんでした。現在の対応範囲は ${registry.map((x) => x.label).join("、")} です。別年度・別学科のルールへは切り替えません。`,
      );
      return;
    }
    const base: Account = {
      email,
      student: parsed.normalized,
      curriculum,
      faculty: parsed.facultyLabel ?? "",
      department: curriculum
        ? `${parsed.facultyLabel} ${parsed.departmentLabel}`
        : "",
      entryYear: Number(parsed.entryYear),
      choices: parsed.choices,
      transferred: parsed.transferred,
    };
    const saved = parsed.choices.length
      ? loadChosenDepartment(
          parsed.normalized,
          parsed.choices.map((x) => x.curriculumId),
        )
      : undefined;
    setAccount(saved ? withDepartment(base, saved) : base);
    setStep(curriculum || saved ? "upload" : "department");
  };
  const chooseDepartment = (curriculumId: string) => {
    if (!account) return;
    saveChosenDepartment(account.student, curriculumId);
    setAccount(withDepartment(account, curriculumId));
    // A result judged under the previous department no longer applies.
    setResult(null);
    setDeptOpen(false);
    setStep("upload");
  };
  const signOut = () => {
    setDeptOpen(false);
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
      return evaluateOutlook(c, gs, { master: courseMaster });
    } catch {
      throw new Error(
        "ルールデータの検証に失敗しました。判定せず、管理者へ確認してください。",
      );
    }
  };

  const departmentDialog = (a: Account, onClose?: () => void) => (
    <DepartmentDialog
      email={a.email}
      faculty={a.faculty}
      entryYear={a.entryYear}
      choices={a.choices}
      initial={a.curriculum?.id}
      onDecide={chooseDepartment}
      onChangeAccount={signOut}
      onClose={onClose}
    />
  );
  // The dialog opens over the login screen, which stays as it was behind it.
  if (step === "login" || step === "department" || !account)
    return (
      <LoginScreen
        onLogin={onLogin}
        blocked={blocked || undefined}
        onLogout={signOut}
        overlay={
          step === "department" && account
            ? departmentDialog(account)
            : undefined
        }
      />
    );
  const c = account.curriculum;
  // Shown with results so a self-reported department is not mistaken for one
  // read from the student number.
  const selfChosen = account.choices.length > 0;

  // Reads the PDF, checks it is the signed-in student's, and assesses it.
  const judge = async (file: File) => {
    if (!c) throw new Error("学科を選んでから判定してください。");
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
      <>
        <UploadScreen
          email={account.email}
          department={account.department}
          entryYear={account.entryYear}
          onChangeDepartment={selfChosen ? () => setDeptOpen(true) : undefined}
          transferred={account.transferred}
          onLogout={signOut}
          onJudge={judge}
        />
        {deptOpen && departmentDialog(account, () => setDeptOpen(false))}
      </>
    );
  if (!c) return null;
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
      department={
        selfChosen ? `${account.department}（本人が選択）` : account.department
      }
      pdfName={pdfName}
      judgedAt={judgedAt}
      unverifiedId={!pdfIds.length}
      transferred={account.transferred}
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
