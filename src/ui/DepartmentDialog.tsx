import { useState } from "react";
import { Button, Dialog } from "./ds";
import type { DepartmentChoice } from "../data/registry";

// JX students' department, asked once after Google sign-in (the student
// number does not say which department they were assigned to).
export function DepartmentDialog({
  email,
  faculty,
  entryYear,
  choices,
  initial = "",
  onDecide,
  onChangeAccount,
  onClose,
}: {
  email: string;
  faculty: string;
  entryYear: number;
  choices: DepartmentChoice[];
  initial?: string;
  onDecide: (curriculumId: string) => void;
  onChangeAccount: () => void;
  // Only when reopened from the upload screen; the first time it must be answered.
  onClose?: () => void;
}) {
  const [picked, setPicked] = useState(initial);
  return (
    <Dialog title="学科を選んでください" width={600} onClose={onClose}>
      <div className="dept-dialog">
        <p className="dept-lead">
          JXで入学した方は、メールアドレスから学科がわかりません。いま所属している学科を選んでください。
        </p>
        <div className="dept-meta">
          <span>
            学部 <b>{faculty}</b>
          </span>
          <span>
            入学年度{" "}
            <b>
              <span className="num">{entryYear}</span>年度
            </b>
          </span>
        </div>
        <div role="radiogroup" aria-label="学科" className="dept-options">
          {choices.map((x) => (
            <label
              key={x.curriculumId}
              className={
                "dept-option" + (picked === x.curriculumId ? " on" : "")
              }
            >
              <input
                type="radio"
                name="department"
                value={x.curriculumId}
                checked={picked === x.curriculumId}
                onChange={() => setPicked(x.curriculumId)}
              />
              <span className="dept-dot" aria-hidden="true" />
              <span>{x.departmentLabel}</span>
            </label>
          ))}
        </div>
        <div className="dept-footer">
          <span className="dept-account">
            <span className="num">{email}</span>
            <button type="button" onClick={onChangeAccount}>
              アカウントを変更
            </button>
          </span>
          <Button
            size="lg"
            iconRight="arrow-right"
            disabled={!picked}
            onClick={() => picked && onDecide(picked)}
          >
            判定をはじめる
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
