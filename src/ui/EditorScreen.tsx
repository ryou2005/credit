import { useState } from "react";
import { courseMaster, sectionLabels } from "../data/registry";
import {
  units,
  type Curriculum,
  type Grade,
  type GradeStatus,
} from "../domain/schema";
import {
  isExcludedSimilar,
  lookupMaster,
  type MasterCourse,
} from "../domain/master";
import { Button, StatusBadge } from "./ds";
import { TopBar } from "./TopBar";

const groupLabels: Record<MasterCourse["group"], string> = {
  I: "第Ⅰ群",
  "II-a": "第Ⅱ群a",
  "II-b": "第Ⅱ群b",
  III: "第Ⅲ群",
  other: "その他",
};
const offering = (x: MasterCourse) =>
  `${courseMaster.departments[x.department]?.label ?? x.department}・${groupLabels[x.group]}・${x.credits}単位`;

// A row the engine cannot count as read: status undecided, course not
// identified, or (for an earned course) credits differing from the master.
export function needsReview(c: Curriculum, g: Grade) {
  const p = c.placements.find((x) => x.courseId === g.courseId);
  const m = g.otherDepartment
    ? courseMaster.courses.find((x) => x.id === g.masterId)
    : undefined;
  const expected = p?.credits ?? m?.credits;
  if (g.status === "unknown" || expected === undefined) return true;
  if (g.status !== "earned") return false;
  try {
    return units(g.credits) !== units(expected);
  } catch {
    return true;
  }
}

// Optional correction of the read grades; the result is recomputed on submit.
export function EditorScreen({
  c,
  email,
  grades,
  setGrades,
  discarded,
  setDiscarded,
  focusIds,
  onLogout,
  onReupload,
  onSubmit,
}: {
  c: Curriculum;
  email: string;
  grades: Grade[];
  setGrades: (f: (gs: Grade[]) => Grade[]) => void;
  discarded: Grade[];
  setDiscarded: (f: (gs: Grade[]) => Grade[]) => void;
  focusIds: string[];
  onLogout: () => void;
  onReupload: () => void;
  onSubmit: () => void;
}) {
  const [added, setAdded] = useState<string[]>([]);
  const [onlyReview, setOnlyReview] = useState(true);
  const focused = onlyReview && focusIds.length > 0;
  // Rows are taken as read (no per-row confirmation); the engine still flags
  // rows it cannot place, and the student fixes them here only when needed.
  const update = (id: string, patch: Partial<Grade>) =>
    setGrades((gs) =>
      gs.map((g) => (g.id === id ? { ...g, ...patch, confirmed: true } : g)),
    );
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
    const id = crypto.randomUUID();
    // Keep a newly added row visible when only the review rows are shown.
    setAdded((a) => [...a, id]);
    setGrades((gs) => [
      ...gs,
      {
        id,
        courseId: "",
        name: "",
        code: "",
        credits: "",
        evaluation: "",
        year: "",
        status: "unknown",
        confirmed: true,
        provenance: { kind: "manual", raw: "本人による手入力" },
      },
    ]);
  };
  return (
    <div className="page">
      <TopBar email={email} onLogout={onLogout} />
      <main className="container editor">
        <div className="editor-head">
          <div>
            <span className="eyebrow">EDIT</span>
            <h1>成績の修正</h1>
            <p className="lead">
              {grades.length}
              件。直したい行だけ修正して「結果を更新する」を押してください。「要確認」の行は卒業判定に算入されていません。
            </p>
          </div>
          <div className="actions">
            <Button
              variant="neutral"
              size="sm"
              iconLeft="upload"
              onClick={onReupload}
            >
              取り込み直す
            </Button>
            <Button variant="neutral" size="sm" onClick={add}>
              ＋ 科目を追加
            </Button>
          </div>
        </div>
        <p className="muted">
          不明な評価は「要確認」のまま残してください。氏名など成績以外の行は「対象外の行として除く」で除外できます。
        </p>
        {!!focusIds.length && (
          <label className="check">
            <input
              type="checkbox"
              checked={onlyReview}
              onChange={(e) => setOnlyReview(e.target.checked)}
            />
            要確認だった行（{focusIds.length}件）だけを表示する
          </label>
        )}
        <div className="grade-list">
          {grades.map((g, index) => {
            if (focused && !focusIds.includes(g.id) && !added.includes(g.id))
              return null;
            const p = c.placements.find((x) => x.courseId === g.courseId);
            const m = courseMaster.courses.find((x) => x.id === g.masterId);
            const found = g.otherDepartment
              ? lookupMaster(courseMaster, c, g.name, { otherDepartment: true })
              : undefined;
            const choice = !m ? found : undefined;
            // Equivalent offerings in several departments: name them all,
            // since the PDF cannot tell which one was taken.
            const offerings =
              m && found && !found.needsChoice && found.candidates.length > 1
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
                  {needsReview(c, g) && (
                    <StatusBadge status="review">要確認</StatusBadge>
                  )}
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
                      onChange={(e) => update(g.id, { year: e.target.value })}
                    />
                  </label>
                  <label>
                    修得状況
                    <select
                      aria-label={`修得状況 ${index + 1}`}
                      value={g.status}
                      onChange={(e) =>
                        update(g.id, { status: e.target.value as GradeStatus })
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
                  <button
                    className="text-button"
                    onClick={() => {
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
          <details className="discarded">
            <summary>
              本人が除外した行：{discarded.length}件（復元できます）
            </summary>
            {discarded.map((g) => (
              <p key={g.id}>
                {g.name}
                <button
                  className="text-button"
                  onClick={() => {
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
        <div className="editor-submit">
          <p className="muted">
            修正内容は「結果を更新する」で判定に反映されます。
          </p>
          <Button
            iconRight="arrow-right"
            onClick={onSubmit}
            disabled={!grades.length}
          >
            結果を更新する
          </Button>
        </div>
      </main>
    </div>
  );
}
