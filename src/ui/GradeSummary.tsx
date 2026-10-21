import { creditText, type Grade } from "../domain/schema";
import { GRADE_SCALE, summarizeGrades } from "../domain/summary";
import { courseMaster } from "../data/registry";

const GPA_SOURCE =
  "https://www.kogakuin.ac.jp/student/syllabus_binran/u53qdr00000037u3-att/gpa_2024.pdf";

// Credit totals of the grade list, modelled on Ku-port's 成績照会 view.
export function GradeSummary({ grades }: { grades: Grade[] }) {
  const s = summarizeGrades(grades, courseMaster);
  const graded = GRADE_SCALE.reduce((a, e) => a + s.byGrade[e], 0);
  const retaking = s.failedCourses.filter((f) => f.retaking).length;
  return (
    <section className="panel grade-summary" aria-label="単位の集計">
      <div className="section-head">
        <h2>単位の集計</h2>
        <span className="badge">{s.courses}科目</span>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <span>取得単位</span>
          <strong>{creditText(s.earned)}</strong>
        </div>
        <div className={"stat" + (s.failed ? " warn" : "")}>
          <span>落単</span>
          <strong>{creditText(s.failed)}</strong>
          <small>
            {s.failedCourses.length}科目
            {retaking ? `（うち再履修中 ${retaking}科目）` : ""}
          </small>
        </div>
        <div className="stat">
          <span>履修中</span>
          <strong>{creditText(s.enrolled)}</strong>
          {!!retaking && <small>再履修中の科目を含む</small>}
        </div>
      </div>
      <h3>評価ごとの単位</h3>
      <div className="grade-bars">
        {GRADE_SCALE.map((e) => (
          <div key={e} className={"grade-bar" + (e === "F" ? " fail" : "")}>
            <span>{e}</span>
            <progress value={s.byGrade[e]} max={graded || 1} aria-label={e} />
            <strong>{creditText(s.byGrade[e])}</strong>
          </div>
        ))}
      </div>
      {!!s.failedCourses.length && (
        <>
          <h3>落単している科目</h3>
          <ul className="failed-list">
            {s.failedCourses.map((f, i) => (
              <li key={i}>
                {f.name}
                <span>
                  {f.credits === null
                    ? "単位数不明"
                    : `${creditText(f.credits)}単位`}
                </span>
                {f.retaking && <span className="badge review">再履修中</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {!!s.unknownCredits.length && (
        <p className="notice">
          単位数が分からない科目があります（{s.unknownCredits.join("、")}
          ）。成績の確認画面で単位数を入力してください。集計には含めていません。
        </p>
      )}
      <p className="small">
        読み取り・入力中の成績から集計しています（未確認の行を含みます）。同じ科目は最も良い評価の1回分で数えるため、再履修で合格した科目は落単に含めません。
        <a href={GPA_SOURCE} target="_blank" rel="noreferrer">
          根拠：成績評価・GPA ↗
        </a>
      </p>
    </section>
  );
}
