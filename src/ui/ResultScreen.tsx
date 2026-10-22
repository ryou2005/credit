import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { evaluateCurriculum } from "../domain/engine";
import { combinedShortfall } from "../domain/shortfall";
import { creditText, type Curriculum } from "../domain/schema";
import {
  Blob,
  Button,
  ProgressBar,
  RequirementRow,
  Shape,
  StatNumber,
  StatusBadge,
  Tabs,
  Toast,
  useEntered,
  type Status,
  type TagTone,
} from "./ds";
import { TopBar } from "./TopBar";

const GPA_SOURCE =
  "https://www.kogakuin.ac.jp/student/syllabus_binran/u53qdr00000037u3-att/gpa_2024.pdf";
type Result = ReturnType<typeof evaluateCurriculum>;
type Rule = Result["results"][number];
type Tab = "grad" | "thesis";

const num = (u: number) => Number(creditText(u));
// Engine status → design status. Within 4 credits of a goal reads as あと少し.
const statusOf = (r: Pick<Rule, "status" | "missing">): Status =>
  r.status === "met"
    ? "done"
    : r.status === "review"
      ? "review"
      : (r.missing ?? 0) <= 400 && r.missing
        ? "near"
        : "short";
const lackText = (r: Rule) =>
  r.metric === "courses" || r.missingCourses
    ? `あと${r.missingCourses?.length ?? r.missing}科目`
    : `あと${creditText(r.missing ?? 0)}単位`;
const isTotal = (r: Rule) =>
  r.expression.type === "credits" && !Object.keys(r.expression.selector).length;
// Rule ids are `${curriculum id}-${suffix}`; thesis-entry rules add `entry-`.
const suffix = (c: Curriculum, r: Rule) =>
  r.id.slice(c.id.length + 1).replace(/^entry-/, "");

// A credit rule whose courses all lie inside another's (e.g. 必修 inside 専門).
function within(a: Rule, b: Rule) {
  if (
    a === b ||
    isTotal(b) ||
    a.expression.type !== "credits" ||
    b.expression.type !== "credits"
  )
    return false;
  const x = a.expression.selector,
    y = b.expression.selector;
  if (!x.sections || !y.sections || x.courseIds || y.courseIds) return false;
  return (
    x.sections.every((s) => y.sections!.includes(s)) &&
    (!y.kinds || (!!x.kinds && x.kinds.every((k) => y.kinds!.includes(k))))
  );
}
// Unmet conditions not already covered by a broader unmet one; the narrower
// ones stay visible in the requirement groups below.
const broadest = (rs: Rule[]) =>
  rs.filter((r) => !rs.some((q) => within(r, q)));

// Which design group a rule's sections fall in, for the category tag.
function categoryOf(r: Rule): [string, TagTone] {
  if (isTotal(r)) return ["合計", "ink"];
  if (r.expression.type === "allCourses") return ["必修", "lilac"];
  const sections =
    r.expression.type === "credits"
      ? (r.expression.selector.sections ?? [])
      : [];
  if (sections.every((s) => s.startsWith("I-"))) return ["第I群", "teal"];
  if (sections.every((s) => s === "II-a")) return ["第II群", "teal"];
  if (sections.every((s) => s === "thesis")) return ["第III群", "coral"];
  return ["第II群＋第III群", "teal"];
}

interface Detail {
  label: string;
  value: string;
  status?: Status;
  badge?: string;
}
interface Row {
  key: string;
  name: string;
  rule?: Rule;
  noReq?: { earned: string; text: string; badge: string };
  details: Detail[];
  note?: string;
}
const ruleDetail = (r: Rule, label = r.label): Detail =>
  r.expression.type === "allCourses"
    ? {
        label,
        value: `${r.expression.courseIds.length - (r.missingCourses?.length ?? 0)} / ${r.expression.courseIds.length} 科目`,
        status: statusOf(r),
        badge:
          r.status === "met"
            ? "達成"
            : r.status === "review"
              ? "要確認"
              : lackText(r),
      }
    : {
        label,
        value: `${creditText(r.earned ?? 0)} / ${creditText(r.required ?? 0)} 単位`,
        status: statusOf(r),
        badge:
          r.status === "met"
            ? "達成"
            : r.status === "review"
              ? "要確認"
              : lackText(r),
      };

export function ResultScreen({
  c,
  result,
  email,
  department,
  pdfName,
  judgedAt,
  unverifiedId,
  toast,
  onCloseToast,
  onLogout,
  onReupload,
  onEdit,
}: {
  c: Curriculum;
  result: Result;
  email: string;
  department: string;
  pdfName: string;
  judgedAt: Date;
  unverifiedId: boolean;
  toast: string;
  onCloseToast: () => void;
  onLogout: () => void;
  onReupload: () => void;
  onEdit: () => void;
}) {
  const entered = useEntered();
  const [hover, setHover] = useState(false);
  const [tab, setTab] = useState<Tab>("grad");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const reqRef = useRef<HTMLElement>(null);
  const hasThesis = result.thesisEntry.results.length > 0;
  const rules =
    tab === "grad" || !hasThesis ? result.results : result.thesisEntry.results;
  const bySuffix = (s: string) => rules.find((r) => suffix(c, r) === s);
  const gradTotal = result.results.find(isTotal);
  const thesisTotal = result.thesisEntry.results.find(isTotal);
  const need = combinedShortfall(c, result.results);
  const thesisNeed = combinedShortfall(c, result.thesisEntry.results);
  const unmet = result.results.filter((r) => r.status !== "met");
  const todo = broadest(unmet);
  const shortList = todo.filter((r) => r.status === "unmet");
  const earned = num(result.earned);
  const goal = gradTotal?.required ? num(gradTotal.required) : 0;
  const marker = thesisTotal?.required ? num(thesisTotal.required) : undefined;
  const sectionCredits = (sections: string[]) =>
    creditText(result.creditsFor({ sections }));

  // Rows of the requirement groups for the selected tab. Rules not placed in a
  // group are listed under その他 so nothing the engine checks goes unseen.
  const used = new Set<string>();
  const take = (s: string) => {
    const r = bySuffix(s);
    if (r) used.add(r.id);
    return r;
  };
  const row = (
    s: string,
    name: string,
    subs: string[] = [],
    note?: string,
    info: Detail[] = [],
  ): Row | null => {
    const rule = take(s);
    if (!rule) return null;
    const details: Detail[] = [
      { label: "必要単位", value: `${creditText(rule.required ?? 0)}単位以上` },
    ];
    for (const x of subs) {
      const sub = take(x);
      if (sub) details.push(ruleDetail(sub));
    }
    return { key: rule.id, name, rule, details: details.concat(info), note };
  };
  const required = (s: string) => {
    const r = bySuffix(s);
    return r ? [r] : [];
  };
  const groups: { label: string; name: string; rows: Row[] }[] = [
    {
      label: "第I群",
      name: "総合教育科目",
      rows: [
        row("I-a", "総合文化科目"),
        row("I-b", "外国語科目", ["I-b-required"]),
        row("I-c", "保健体育科目"),
        {
          key: "I-d",
          name: "キャリア支援科目",
          noReq: {
            earned: sectionCredits(["I-d"]),
            text: "区分ごとの必要単位はありません。取得した単位は総取得単位に含まれます。",
            badge: "条件なし",
          },
          details: [],
        },
      ].filter((x): x is Row => !!x),
    },
    {
      label: "第II群",
      name: "専門共通科目",
      rows: [row("II-a", "共通基礎科目", ["II-a-required"])].filter(
        (x): x is Row => !!x,
      ),
    },
    {
      label: "第II群＋第III群",
      name: "合算して判定",
      rows: [
        row(
          "special",
          "専門基礎＋専門科目（卒論以外）",
          [
            "mandatory-special",
            "mandatory-named",
            "selective",
            "III-A-selective",
            "III-B-selective",
            "III-C-selective",
          ],
          "専門基礎科目と専門科目（卒業論文以外）は、合算した単位数で判定します。他学科の科目は学部枠として最大6単位まで含みます。",
          [
            {
              label: "内訳：専門基礎科目",
              value: `${sectionCredits(["II-b"])} 単位`,
            },
            {
              label: "内訳：専門科目（卒業論文以外）",
              value: `${sectionCredits(["III-A", "III-B", "III-C", "III-common"])} 単位`,
            },
            {
              label: "内訳：他学科の科目（学部枠）",
              value: `${sectionCredits(["external"])} 単位`,
            },
          ],
        ),
      ].filter((x): x is Row => !!x),
    },
    {
      label: "第III群",
      name: "専門科目",
      rows: [
        tab === "grad"
          ? row(
              "thesis",
              "卒業論文",
              [],
              "卒業論文は、ほかの区分とは別の卒業要件として判定します。",
            )
          : {
              key: "thesis-none",
              name: "卒業論文",
              noReq: {
                earned: sectionCredits(["thesis"]),
                text: "卒業論文着手条件には含まれません。",
                badge: "対象外",
              },
              details: [],
            },
      ].filter((x): x is Row => !!x),
    },
  ];
  // Mark the rules shown elsewhere (total in the hero, required lists below).
  rules.filter(isTotal).forEach((r) => used.add(r.id));
  const mandatoryBoxes = [
    ...required("I-b-required"),
    ...required("II-a-required"),
    ...required("mandatory-special"),
    ...required("selective"),
    ...required("III-A-selective"),
    ...required("III-B-selective"),
    ...required("III-C-selective"),
  ];
  const courseLists = rules.filter((r) => r.expression.type === "allCourses");
  [...mandatoryBoxes, ...courseLists].forEach((r) => used.add(r.id));
  const rest = rules.filter((r) => !used.has(r.id));
  if (rest.length)
    groups.push({
      label: "その他",
      name: "その他の条件",
      rows: rest.map((r) => ({
        key: r.id,
        name: r.label,
        rule: r,
        details: [],
      })),
    });
  const courseName = (id: string) =>
    c.courses.find((x) => x.id === id)?.name ?? id;

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const heroStatus: Status =
    result.status === "met"
      ? "done"
      : result.status === "review"
        ? "review"
        : "near";
  const reviewCount = result.issues.length;
  const showThesis = (e: MouseEvent) => {
    e.preventDefault();
    setTab("thesis");
    const el = reqRef.current;
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 24,
        behavior: "smooth",
      });
  };
  const thesisText =
    result.thesisEntry.status === "met"
      ? `${thesisTotal ? creditText(thesisTotal.required ?? 0) : ""}単位以上・科目区分の条件をすべて満たしています`
      : result.thesisEntry.status === "review"
        ? "読み取れなかった成績があるため、確定できません"
        : `着手条件まで、あと${creditText(thesisNeed)}単位です`;

  return (
    <div className="page result">
      <Shape
        entered={entered}
        hover={hover}
        delay={300}
        className="result-sun"
        moved="translate(-22px, 18px) rotate(-20deg)"
      >
        <Blob shape={3} color="sun" size={300} rotate={-16} />
      </Shape>
      <TopBar email={email} onLogout={onLogout} />
      <main className="container">
        <div className="result-meta">
          <div className="meta-items">
            <span className="meta-strong">
              {c.label.split("・")[0]} {department}（{c.entryYear}年度入学）
            </span>
            <span>成績PDF：{pdfName}</span>
            <span>
              判定日：
              <span className="num">
                {judgedAt.getFullYear()}.
                {String(judgedAt.getMonth() + 1).padStart(2, "0")}.
                {String(judgedAt.getDate()).padStart(2, "0")}
              </span>
            </span>
            {unverifiedId && (
              <span className="meta-warn">
                PDF内の学籍番号を照合できませんでした
              </span>
            )}
          </div>
          <div className="actions">
            <Button
              variant="neutral"
              size="sm"
              iconLeft="pencil"
              onClick={onEdit}
            >
              成績を修正する{reviewCount ? `（要確認 ${reviewCount}件）` : ""}
            </Button>
            <Button
              variant="neutral"
              size="sm"
              iconLeft="upload"
              onClick={onReupload}
            >
              別のPDFをアップロード
            </Button>
          </div>
        </div>

        <section className="hero">
          <div className="hero-copy">
            <StatusBadge status={heroStatus} size="lg">
              {result.status === "met"
                ? "卒業条件 達成"
                : result.status === "review"
                  ? "要確認"
                  : "卒業条件 未達成"}
            </StatusBadge>
            <h1>
              {need > 0 ? (
                <>
                  卒業まで、
                  <br />
                  あと<mark>{creditText(need)}単位</mark>。
                </>
              ) : result.status === "met" ? (
                <>
                  卒業条件を、
                  <br />
                  <mark>すべて満たしています</mark>。
                </>
              ) : (
                <>
                  確認が必要な
                  <br />
                  <mark>成績があります</mark>。
                </>
              )}
            </h1>
            <p className="hero-lead">
              {need > 0 && (
                <>
                  不足している条件：
                  {shortList
                    .slice(0, 4)
                    .map((r) => `${r.label}（${lackText(r)}）`)
                    .join("、")}
                  {shortList.length > 4 && ` ほか${shortList.length - 4}件`}
                  。重なる分を除いて合わせた単位数です。科目区分ごとの詳細は、下の「科目区分別の取得状況」で確認できます。
                </>
              )}
              {result.status === "met" &&
                "登録済みの卒業要件（単位数・区分・必修・選択必修）をすべて満たしています。"}
              {result.status === "review" &&
                ` 読み取れなかった行（${reviewCount}件）は算入していません。「成績を修正する」から確認してください。`}
            </p>
            {hasThesis && (
              <div className="thesis-pill">
                <StatusBadge
                  status={
                    result.thesisEntry.status === "met"
                      ? "done"
                      : result.thesisEntry.status === "review"
                        ? "review"
                        : "near"
                  }
                  size="lg"
                >
                  {result.thesisEntry.status === "met"
                    ? "達成"
                    : result.thesisEntry.status === "review"
                      ? "要確認"
                      : "未達成"}
                </StatusBadge>
                <span className="pill-text">
                  <strong>卒業論文着手条件</strong>
                  <small>{thesisText}</small>
                </span>
                <a href="#requirements" onClick={showThesis}>
                  内訳を見る
                </a>
              </div>
            )}
          </div>
          <div
            className="hero-art"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <Shape
              entered={entered}
              hover={hover}
              delay={80}
              className="hero-teal"
              moved="scale(1.05) rotate(8deg)"
            >
              <Blob shape={1} color="teal" size={560} />
            </Shape>
            <Shape
              entered={entered}
              hover={hover}
              delay={520}
              className="hero-coral"
              moved="translate(18px, -20px) scale(1.2)"
            >
              <Blob shape={4} color="coral" size={80} />
            </Shape>
            <div
              className="credit-card-wrap"
              style={{
                opacity: entered ? 1 : 0,
                transform: entered ? "none" : "translateY(40px)",
                transition:
                  "opacity 900ms var(--ease-out) 360ms, transform 1000ms var(--ease-out) 360ms",
              }}
            >
              <div
                className="credit-card"
                style={{ transform: hover ? "translateY(-8px)" : "none" }}
              >
                <div className="row-between">
                  <span className="label-muted">総取得単位</span>
                  <span className="eyebrow subtle">CREDITS</span>
                </div>
                <StatNumber
                  value={creditText(result.earned)}
                  total={goal || undefined}
                  unit="単位"
                  size="xl"
                />
                <div className="credit-bar">
                  <ProgressBar
                    value={earned}
                    max={goal || 1}
                    size="lg"
                    tone="teal"
                    marker={marker}
                    label="総取得単位"
                  />
                  <div className="bar-labels">
                    {marker != null && goal > 0 && (
                      <span style={{ left: `${(marker / goal) * 100}%` }}>
                        卒論着手 <span className="num">{marker}</span>
                      </span>
                    )}
                    <span className="end num">{goal}</span>
                  </div>
                </div>
                <div className="credit-progress">
                  <div className="row-between">
                    <span className="label-strong">単位取得進捗</span>
                    <span className="label-muted">
                      約
                      <b className="num">
                        {goal
                          ? Math.min(100, Math.floor((earned / goal) * 100))
                          : 0}
                      </b>
                      <b className="num">%</b>
                    </span>
                  </div>
                  <span className="fine">
                    総取得単位だけの進捗です。卒業の判定は、科目区分ごとの条件もあわせて行います。
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {result.status !== "met" && unmet.length > 0 && (
          <section className="block">
            <Heading eyebrow="TO DO" title="卒業までに必要な条件" />
            <div className="todo-grid">
              <div className="rows">
                {todo.map((r) => {
                  const [category, tone] = categoryOf(r);
                  const courses =
                    r.expression.type === "allCourses"
                      ? r.expression.courseIds.length
                      : 0;
                  return (
                    <RequirementRow
                      key={r.id}
                      name={r.label}
                      category={category}
                      categoryTone={tone}
                      earned={
                        courses
                          ? courses - (r.missingCourses?.length ?? 0)
                          : num(r.earned ?? 0)
                      }
                      required={courses || num(r.required ?? 0)}
                      unit={courses ? "科目" : "単位"}
                      status={statusOf(r)}
                      lack={lackText(r)}
                    />
                  );
                })}
              </div>
              {need > 0 && (
                <div className="todo-note">
                  <strong>重なる分を除くと、あと{creditText(need)}単位</strong>
                  <span>
                    条件ごとの不足は重なることがあります（たとえば卒業論文の単位は総取得単位にも入ります）。重なりを除くと、不足は合わせて
                    <b className="num">{creditText(need)}</b>単位です。
                  </span>
                </div>
              )}
            </div>
            <div className="dot-line">
              <span className="dot" />
              {unmet.length === todo.length
                ? "ほかの科目区分・必修・選択必修は、すべて卒業条件を満たしています。"
                : "上の条件に含まれる必修・選択必修などの状況は、下の「科目区分別の取得状況」で確認できます。"}
            </div>
          </section>
        )}

        <section id="requirements" ref={reqRef} className="block">
          <div className="req-head">
            <Heading eyebrow="REQUIREMENTS" title="科目区分別の取得状況" />
            {hasThesis && (
              <div className="tab-box">
                <span className="label-muted">判定の基準</span>
                <Tabs
                  items={[
                    { value: "grad" as Tab, label: "卒業条件" },
                    { value: "thesis" as Tab, label: "卒論着手条件" },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
              </div>
            )}
          </div>
          <p className="muted req-lead">
            {tab === "grad"
              ? `卒業条件（総取得単位${goal}単位以上）に対する各区分の状況です。`
              : `卒業論文着手条件（総取得単位${marker ?? ""}単位以上）に対する各区分の状況です。`}
            行をクリックすると、条件の内訳を確認できます。
          </p>
          <div className="groups">
            {groups
              .filter((g) => g.rows.length)
              .map((g) => (
                <div className="group" key={g.label}>
                  <div className="group-label">
                    <span>{g.label}</span>
                    <strong>{g.name}</strong>
                  </div>
                  <div className="rows">
                    {g.rows.map((r) => (
                      <div key={r.key}>
                        {r.rule ? (
                          <RequirementRow
                            name={r.name}
                            earned={num(r.rule.earned ?? 0)}
                            required={num(r.rule.required ?? 0)}
                            status={statusOf(r.rule)}
                            lack={lackText(r.rule)}
                            open={!!open[r.key]}
                            onClick={() => toggle(r.key)}
                          />
                        ) : (
                          r.noReq && (
                            <div className="req-row none">
                              <span className="req-name">
                                <span>{r.name}</span>
                              </span>
                              <span className="req-bar none-text">
                                {r.noReq.text}
                              </span>
                              <span className="req-value">
                                <strong>{r.noReq.earned}</strong>
                                <small>単位</small>
                              </span>
                              <span className="req-badge">
                                <StatusBadge status="none">
                                  {r.noReq.badge}
                                </StatusBadge>
                              </span>
                              <span />
                            </div>
                          )
                        )}
                        {r.rule && open[r.key] && (
                          <div className="details">
                            {r.details.map((d) => (
                              <div className="detail" key={d.label}>
                                <span>{d.label}</span>
                                <span className="detail-value">{d.value}</span>
                                <span>
                                  {d.status && (
                                    <StatusBadge status={d.status}>
                                      {d.badge}
                                    </StatusBadge>
                                  )}
                                </span>
                              </div>
                            ))}
                            {r.note && (
                              <span className="detail-note">{r.note}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          <div className="mandatory">
            <div className="row-between wrap">
              <h3>必修・選択必修の充足状況</h3>
              <span className="muted">
                {tab === "grad" ? "卒業条件" : "卒業論文着手条件"}の基準
              </span>
            </div>
            <div className="mandatory-grid">
              {mandatoryBoxes.map((r) => (
                <div className="mandatory-box" key={r.id}>
                  <span className="label-muted">
                    {r.label.replace("専門基礎＋専門の", "専門分野の")}
                  </span>
                  <StatNumber
                    value={creditText(r.earned ?? 0)}
                    total={creditText(r.required ?? 0)}
                    unit="単位"
                    size="md"
                  />
                  <StatusBadge status={statusOf(r)}>
                    {r.status === "met"
                      ? "達成"
                      : r.status === "review"
                        ? "要確認"
                        : lackText(r)}
                  </StatusBadge>
                </div>
              ))}
            </div>
            {courseLists.map((r) => (
              <div className="course-list" key={r.id}>
                <div className="row-between wrap">
                  <strong>{r.label}</strong>
                  <StatusBadge status={statusOf(r)}>
                    {r.status === "met"
                      ? "すべて修得"
                      : r.status === "review"
                        ? "要確認"
                        : lackText(r)}
                  </StatusBadge>
                </div>
                {!!r.missingCourses?.length && (
                  <p>
                    {r.status === "review"
                      ? "修得を確認できない必修科目"
                      : "未修得の必修科目"}
                    ：{r.missingCourses.map(courseName).join("、")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <footer className="result-footer">
          <span>
            本サービスの判定結果は、成績PDFと登録済みの卒業要件にもとづく参考情報です。正式な卒業要件は、大学の履修要項等で確認してください。
          </span>
          <span>本サービスは工学院大学の公式サービスではありません。</span>
          <span>
            判定の根拠：
            <a href={c.source.url} target="_blank" rel="noreferrer">
              {c.entryYear}年度入学生用 カリキュラム表・進級卒業条件表（公式PDF
              p{c.source.pages.join("・")}）↗
            </a>
            {" ／ 合否の基準："}
            <a href={GPA_SOURCE} target="_blank" rel="noreferrer">
              成績評価の種類（公式PDF）↗
            </a>
          </span>
        </footer>
      </main>
      <div className={"toast-wrap" + (toast ? " on" : "")}>
        {toast && <Toast onClose={onCloseToast}>{toast}</Toast>}
      </div>
    </div>
  );
}

function Heading({ eyebrow, title }: { eyebrow: string; title: ReactNode }) {
  return (
    <div className="heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}

// Hides the toast a few seconds after it appears.
export function useToast() {
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3400);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast] as const;
}
