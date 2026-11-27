import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { Outlook } from "../domain/outlook";
import { combinedShortfall, shortfallWithin } from "../domain/shortfall";
import { creditText, matches, units, type Curriculum } from "../domain/schema";
import {
  Blob,
  Button,
  RequirementRow,
  Shape,
  StatNumber,
  StatusBadge,
  Tabs,
  Toast,
  useEntered,
  type Status,
} from "./ds";
import { TopBar } from "./TopBar";

const GPA_SOURCE =
  "https://www.kogakuin.ac.jp/student/syllabus_binran/u53qdr00000037u3-att/gpa_2024.pdf";
type Assessment = Outlook["projected"];
type Rule = Assessment["results"][number];
type Tab = "grad" | "thesis";
// Courses listed in an opened row before 「すべての科目を表示」.
const COURSE_LIMIT = 9;

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
// The 区分 whose shortfall is listed under 足りない単位 (graduation rules).
const CATEGORIES = [
  ["I-a", "第I群", "総合文化科目"],
  ["I-b", "第I群", "外国語科目"],
  ["I-c", "第I群", "保健体育科目"],
  ["II-a", "第II群", "共通基礎科目"],
  ["special", "第II群＋第III群", "専門基礎＋専門科目"],
] as const;

interface Detail {
  label: string;
  value: string;
  status?: Status;
  badge?: string;
}
interface Course {
  id: string;
  name: string;
  credits: string;
  enrolled: boolean;
}
interface Row {
  key: string;
  name: string;
  rule?: Rule;
  noReq?: { earned: string; text: string; badge: string };
  details: Detail[];
  note?: string;
  courses?: Course[];
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
  transferred,
  toast,
  onCloseToast,
  onLogout,
  onReupload,
  onEdit,
}: {
  c: Curriculum;
  result: Outlook;
  email: string;
  department: string;
  pdfName: string;
  judgedAt: Date;
  unverifiedId: boolean;
  // 出席番号401以降（転籍・編入学）.
  transferred: boolean;
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
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const reqRef = useRef<HTMLElement>(null);
  const { projected, planned } = result;
  const hasThesis = result.thesisEntry.results.length > 0;
  const onThesisTab = tab === "thesis" && hasThesis;
  const rules = onThesisTab ? result.thesisEntry.results : result.results;
  // The same rules once the 履修中 courses are passed.
  const projectedRules = onThesisTab
    ? projected.thesisEntry.results
    : projected.results;
  const projectedOf = (r: Rule) => projectedRules.find((x) => x.id === r.id);
  const bySuffix = (s: string) => rules.find((r) => suffix(c, r) === s);
  const gradTotal = result.results.find(isTotal);
  const thesisTotal = result.thesisEntry.results.find(isTotal);
  const goal = gradTotal?.required ?? 0;
  const entryGoal = thesisTotal?.required;

  // Credits (×100) passed, being taken this term, and the 卒論 assumed.
  const earnedU = result.earned;
  const nowU = projected.earned - result.earned;
  const thesisU = planned.earned - projected.earned;
  // 不足 = what is still missing once 履修中 and the 卒論 are passed.
  const need = combinedShortfall(c, planned.results);
  const shorts = CATEGORIES.flatMap(([s, group, name]) => {
    const r = result.results.find((x) => suffix(c, x) === s);
    if (r?.expression.type !== "credits") return [];
    const short = shortfallWithin(c, planned.results, r.expression.selector);
    return short > 0 ? [{ id: r.id, group, name, short }] : [];
  });
  const catShort = shorts.reduce((a, x) => a + x.short, 0);
  const free = Math.max(0, need - catShort);
  const isShort = need > 0;
  // How many 履修中 credits may be dropped with every condition still met:
  // the least margin of the conditions they count toward (worst case).
  let slack = nowU;
  for (const r of planned.results) {
    if (r.expression.type !== "credits") continue;
    const gain =
      (projected.results.find((x) => x.id === r.id)?.earned ?? 0) -
      (result.results.find((x) => x.id === r.id)?.earned ?? 0);
    if (gain > 0)
      slack = Math.min(slack, Math.max(0, (r.earned ?? 0) - (r.required ?? 0)));
  }
  const requiredNow = projected.counted.some(
    (x) =>
      x.enrolled &&
      planned.results.some(
        (r) =>
          r.expression.type === "allCourses" &&
          r.expression.courseIds.includes(x.placement.courseId),
      ),
  );
  // 卒論着手: shortfall now and once the 履修中 courses are passed.
  const entryGap = combinedShortfall(c, result.thesisEntry.results);
  const entryGapNow = combinedShortfall(c, projected.thesisEntry.results);

  const sectionCredits = (sections: string[]) =>
    creditText(result.creditsFor({ sections }));
  // 第Ⅲ群 sections other than the thesis (区分 names differ by department).
  const thirdSections = [
    ...new Set(
      c.placements.map((p) => p.section).filter((s) => s.startsWith("III-")),
    ),
  ];
  // Per-区分 選択必修 conditions (CS: III-A〜C, 情報科学科: 経営情報など,
  // 情報通信工学科: area-*). 情報デザイン学科 has none.
  const areaSuffixes = rules
    .map((r) => suffix(c, r))
    .filter((s) => /^III-.+-selective$|^area-/.test(s));
  // 情報科学科 p4 注4: the 卒論着手 65単位 leaves out other departments' courses.
  const specialExpr = bySuffix("special")?.expression;
  const externalCounts =
    specialExpr?.type !== "credits" ||
    !!specialExpr.selector.sections?.includes("external");
  // Counted and 履修中 courses of a rule, 履修中 first.
  const coursesOf = (r: Rule): Course[] => {
    const e = r.expression;
    if (e.type !== "credits") return [];
    return projected.counted
      .filter((x) => !x.assumed && matches(x.placement, e.selector))
      .map((x) => ({
        id: x.placement.courseId,
        name: x.name,
        credits: `${creditText(units(x.placement.credits))}単位`,
        enrolled: x.enrolled,
      }))
      .sort((a, b) => Number(b.enrolled) - Number(a.enrolled));
  };

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
    const required = rule.required ?? 0;
    const earned = rule.earned ?? 0;
    const gain = (projectedOf(rule)?.earned ?? 0) - earned;
    const details: Detail[] = [
      { label: "必要単位", value: `${creditText(required)}単位以上` },
    ];
    if (gain > 0)
      details.push({ label: "履修中", value: `${creditText(gain)} 単位` });
    for (const x of subs) {
      const sub = take(x);
      if (sub) details.push(ruleDetail(sub));
    }
    const nowNote =
      gain > 0 && rule.status !== "met"
        ? earned + gain >= required
          ? `履修中の${creditText(gain)}単位を取得すると達成します。`
          : `履修中の${creditText(gain)}単位を取得しても、あと${creditText(required - earned - gain)}単位足りません。`
        : "";
    return {
      key: rule.id,
      name,
      rule,
      details: details.concat(info),
      note: [note, nowNote].filter(Boolean).join("") || undefined,
      courses: coursesOf(rule),
    };
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
            ...areaSuffixes,
          ],
          externalCounts
            ? "専門基礎科目と専門科目（卒業論文以外）は、合算した単位数で判定します。他学科の科目は学部枠として最大6単位まで含みます。"
            : "専門基礎科目と専門科目（卒業論文以外）は、合算した単位数で判定します。卒業論文着手の条件には、他学科の科目を含みません。",
          [
            {
              label: "内訳：専門基礎科目",
              value: `${sectionCredits(["II-b"])} 単位`,
            },
            {
              label: "内訳：専門科目（卒業論文以外）",
              value: `${sectionCredits(thirdSections)} 単位`,
            },
            ...(externalCounts
              ? [
                  {
                    label: "内訳：他学科の科目（学部枠）",
                    value: `${sectionCredits(["external"])} 単位`,
                  },
                ]
              : []),
          ],
        ),
      ].filter((x): x is Row => !!x),
    },
    {
      label: "第III群",
      name: "専門科目",
      rows: [
        !onThesisTab
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
    ...areaSuffixes.flatMap(required),
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
  const reviewCount = result.issues.length;
  const review = result.status === "review";
  const scrollToRequirements = () => {
    const el = reqRef.current;
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 24,
        behavior: "smooth",
      });
  };
  const showThesis = (e: MouseEvent) => {
    e.preventDefault();
    setTab("thesis");
    scrollToRequirements();
  };
  // A 足りない単位 row opens its 区分 on the 卒業条件 tab.
  const jump = (id: string) => {
    setTab("grad");
    setOpen((o) => ({ ...o, [id]: true }));
    scrollToRequirements();
  };

  const t = creditText;
  const heroBadge: [Status, string] = review
    ? ["review", "要確認"]
    : isShort
      ? ["short", `不足 ${t(need)}単位`]
      : ["done", "不足なし"];
  // What the shortfall takes as given, for the lead text.
  const assumptions = [
    nowU > 0 && `履修中の${t(nowU)}単位`,
    thesisU > 0 && `卒業論文（${t(thesisU)}単位）`,
  ].filter(Boolean);
  const lead = isShort
    ? (shorts.length
        ? `${shorts.length}つの区分で${t(catShort)}単位が不足しています。`
        : "") +
      (free > 0
        ? `${shorts.length ? "残りの" : ""}${t(free)}単位は、どの区分の科目でも構いません。`
        : "") +
      (assumptions.length
        ? `${assumptions.join("と")}は、すべて取得する前提です。`
        : "")
    : result.status === "met"
      ? "登録済みの卒業要件（単位数・区分・必修・選択必修）をすべて満たしています。"
      : assumptions.length
        ? `${[nowU > 0 && `今学期の履修中科目（${t(nowU)}単位）`, thesisU > 0 && `卒業論文（${t(thesisU)}単位）`].filter(Boolean).join("と")}を取得すれば、卒業条件をすべて満たします。`
        : "";

  // The bar: passed, 履修中, still missing, then the 卒論 assumed.
  const scale = Math.max(goal, earnedU + nowU + need + thesisU, 1);
  const at = (u: number) => `${(u / scale) * 100}%`;
  const noteTone = isShort ? "short" : nowU > 0 && slack === 0 ? "tight" : "ok";
  const barNote = isShort
    ? nowU > 0
      ? `履修中の${t(nowU)}単位をすべて取得しても、卒業条件まであと${t(need)}単位足りません。`
      : `卒業条件まで、あと${t(need)}単位足りません。`
    : nowU === 0
      ? thesisU > 0
        ? `卒業論文（${t(thesisU)}単位）を取得すれば、卒業条件を満たします。`
        : "取得済みの単位で、卒業条件を満たしています。"
      : slack === 0
        ? `履修中の${t(nowU)}単位は、1単位も落とせません。1科目でも落とすと不足になります。`
        : `履修中の科目のうち、${requiredNow ? "必修科目を除いて" : ""}${t(slack)}単位までは落としても卒業条件を満たします。`;

  // 卒論着手 pill: 達成 / 履修中で届く (あと少し) / 不足.
  const entryState: Status =
    result.thesisEntry.status === "review"
      ? "review"
      : result.thesisEntry.status === "met"
        ? "done"
        : entryGapNow === 0
          ? "near"
          : "short";
  const entryBadge =
    entryState === "review"
      ? "要確認"
      : entryState === "done"
        ? "達成"
        : `あと${t(entryGap)}単位`;
  const entryText =
    entryState === "review"
      ? "読み取れなかった成績があるため、確定できません"
      : entryState === "done"
        ? `${entryGoal ? t(entryGoal) : ""}単位以上・科目区分の条件をすべて満たしています`
        : entryState === "near"
          ? `履修中の${t(nowU)}単位を取得すると、着手条件を満たします`
          : nowU > 0
            ? `履修中の${t(nowU)}単位を取得しても、着手条件まであと${t(entryGapNow)}単位です`
            : `着手条件まで、あと${t(entryGap)}単位です`;

  const entryLabel = entryGoal ? `（${t(entryGoal)}単位）` : "";
  const nextSteps: [string, string][] = isShort
    ? [
        [
          "来期の履修登録で、不足分を優先する",
          shorts.length
            ? `${shorts.map((x) => x.name).join("・")}の科目を先に登録してください。${free > 0 ? `区分を問わない${t(free)}単位は、そのあとで選べます。` : ""}`
            : `どの区分の科目でも構いません。あと${t(free)}単位を登録してください。`,
        ],
        ...(hasThesis && entryState !== "done" && entryState !== "review"
          ? [
              [
                nowU > 0
                  ? `履修中の${t(nowU)}単位を取り切る`
                  : "卒業論文の着手条件を満たす",
                entryGapNow === 0
                  ? `取得すると卒業論文の着手条件${entryLabel}を満たし、卒論をはじめられます。`
                  : `${nowU > 0 ? "取得しても" : ""}着手条件まであと${t(entryGapNow)}単位です。来期は${t(entryGapNow)}単位以上の上積みが必要です。`,
              ] as [string, string],
            ]
          : nowU > 0
            ? [
                [
                  `履修中の${t(nowU)}単位を取り切る`,
                  "不足の計算は、履修中の単位をすべて取得する前提です。落とすと、その分だけ不足が増えます。",
                ] as [string, string],
              ]
            : []),
        [
          "教務窓口で履修計画を確認する",
          "判定は目安です。来期に取る科目が条件に合うか、履修登録の前に教務窓口で確認してください。",
        ],
      ]
    : [
        ...(nowU > 0
          ? [
              [
                `履修中の${t(nowU)}単位を取り切る`,
                slack === 0
                  ? "1科目でも落とすと不足になります。出席と課題の提出を優先してください。"
                  : `余裕は${t(slack)}単位です。${requiredNow ? "必修科目は落とせません。" : ""}`,
              ] as [string, string],
            ]
          : []),
        ...(thesisU > 0
          ? [
              [
                "卒業論文の着手手続きをする",
                "研究室配属と着手届の時期を、学科の案内で確認してください。",
              ] as [string, string],
            ]
          : []),
        [
          "教務窓口で最終確認する",
          "判定は目安です。卒業見込みの正式な確認は、教務窓口で行ってください。",
        ],
      ];

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
            {transferred && (
              <span className="meta-warn">
                転籍・編入学の学籍番号：認定単位などは教務窓口で確認してください
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
            <StatusBadge status={heroBadge[0]} size="lg">
              {heroBadge[1]}
            </StatusBadge>
            <h1>
              {isShort ? (
                <>
                  卒業まで、
                  <br />
                  <mark>あと{t(need)}単位</mark>。
                </>
              ) : review ? (
                <>
                  確認が必要な
                  <br />
                  <mark>成績があります</mark>。
                </>
              ) : result.status === "met" ? (
                <>
                  卒業条件を、
                  <br />
                  <mark>すべて満たしています</mark>。
                </>
              ) : (
                <>
                  このまま進めば、
                  <br />
                  <mark>卒業できます</mark>。
                </>
              )}
            </h1>
            <p className="hero-lead">
              {lead}
              {review &&
                ` 読み取れなかった行（${reviewCount}件）は算入していません。「成績を修正する」から確認してください。`}
            </p>
            {hasThesis && (
              <div className="thesis-pill">
                <StatusBadge status={entryState} size="lg">
                  {entryBadge}
                </StatusBadge>
                <span className="pill-text">
                  <strong>卒業論文着手条件</strong>
                  <small>{entryText}</small>
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
                  value={t(earnedU)}
                  total={goal ? t(goal) : undefined}
                  unit="単位"
                  size="xl"
                />
                <div className="credit-bar">
                  <div
                    className="seg-bar"
                    role="img"
                    aria-label={`取得済み${t(earnedU)}単位、履修中${t(nowU)}単位、不足${t(need)}単位、卒業論文${t(thesisU)}単位（卒業条件${t(goal)}単位）`}
                  >
                    <div className="seg-track">
                      {(
                        [
                          ["earned", earnedU],
                          ["now", nowU],
                          ["short", need],
                          ["thesis", thesisU],
                        ] as const
                      )
                        .filter(([, u]) => u > 0)
                        .map(([k, u]) => (
                          <div
                            key={k}
                            className={`seg ${k}`}
                            style={{ flex: u }}
                          />
                        ))}
                    </div>
                    {entryGoal != null && goal > 0 && (
                      <div
                        className="seg-mark"
                        style={{ left: at(entryGoal) }}
                      />
                    )}
                    {thesisU > 0 && (
                      <div
                        className="seg-mark thesis"
                        style={{ left: at(scale - thesisU) }}
                      />
                    )}
                  </div>
                  <div className="bar-labels">
                    {entryGoal != null && goal > 0 && (
                      <span style={{ left: at(entryGoal) }}>
                        卒論着手 <span className="num">{t(entryGoal)}</span>
                      </span>
                    )}
                    <span className="end num" style={{ left: at(goal) }}>
                      {t(goal)}
                    </span>
                  </div>
                </div>
                <div className="legend">
                  {(
                    [
                      ["earned", "取得済み", earnedU],
                      ["now", "履修中", nowU],
                      ["thesis", "卒業論文", thesisU],
                      ["short", "不足", need],
                    ] as const
                  ).map(([k, label, u]) => (
                    <span key={k}>
                      <span className="legend-key">
                        <i className={`seg ${k}`} />
                        {label}
                      </span>
                      <b className={k === "short" && !u ? "zero" : k}>{t(u)}</b>
                    </span>
                  ))}
                </div>
                <div className={`bar-note ${noteTone}`}>
                  <i />
                  <span>{barNote}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isShort && (
          <section className="block">
            <Heading eyebrow="SHORTAGE" tone="coral" title="足りない単位" />
            <div className="short-grid">
              <div className="rows">
                {shorts.map((s) => (
                  <button
                    type="button"
                    className="short-row"
                    key={s.id}
                    onClick={() => jump(s.id)}
                  >
                    <span className="short-name">
                      <small>{s.group}</small>
                      <strong>{s.name}</strong>
                    </span>
                    <ShortAmount value={t(s.short)} />
                    <span className="short-hint">来期に履修</span>
                  </button>
                ))}
                {free > 0 && (
                  <div className="short-row free">
                    <span className="short-name">
                      <small>区分を問わない</small>
                      <strong>総取得単位の残り</strong>
                    </span>
                    <ShortAmount value={t(free)} />
                    <span className="short-hint">どの区分の科目でも可</span>
                  </div>
                )}
              </div>
              <div className="short-note">
                <strong>合計で{t(need)}単位が足りません</strong>
                <span>
                  {shorts.length
                    ? `区分の条件がある${t(catShort)}単位を先に埋めてください。行をクリックすると、その区分の取得状況に移動します。`
                    : "区分の条件はすべて満たしています。総取得単位だけが不足しています。"}
                </span>
              </div>
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
            {!onThesisTab
              ? `卒業条件（総取得単位${t(goal)}単位以上）に対する各区分の状況です。`
              : `卒業論文着手条件（総取得単位${entryGoal ? t(entryGoal) : ""}単位以上）に対する各区分の状況です。`}
            行をクリックすると、条件の内訳と対象の科目を確認できます。
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
                            {!!r.courses?.length && (
                              <CourseChips
                                courses={r.courses}
                                all={!!showAll[r.key]}
                                onToggle={() =>
                                  setShowAll((o) => ({
                                    ...o,
                                    [r.key]: !o[r.key],
                                  }))
                                }
                              />
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
                {!onThesisTab ? "卒業条件" : "卒業論文着手条件"}の基準
              </span>
            </div>
            <div className="mandatory-grid">
              {mandatoryBoxes.map((r) => (
                <div className="mandatory-box" key={r.id}>
                  <span className="label-muted">
                    {r.label.replace("専門基礎＋専門の", "専門分野の")}
                  </span>
                  <StatNumber
                    value={t(r.earned ?? 0)}
                    total={t(r.required ?? 0)}
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

        <section className="block">
          <Heading eyebrow="NEXT" title="次にやること" />
          <ol className="next-grid">
            {nextSteps.map(([title, text], i) => (
              <li className="next-step" key={title}>
                <span className="next-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ol>
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

function Heading({
  eyebrow,
  title,
  tone,
}: {
  eyebrow: string;
  title: ReactNode;
  tone?: "coral";
}) {
  return (
    <div className="heading">
      <span className={"eyebrow" + (tone ? ` ${tone}` : "")}>{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}

function ShortAmount({ value }: { value: string }) {
  return (
    <span className="short-amount">
      <span>あと</span>
      <b>{value}</b>
      <small>単位</small>
    </span>
  );
}

// The counted and 履修中 courses of an opened row.
function CourseChips({
  courses,
  all,
  onToggle,
}: {
  courses: Course[];
  all: boolean;
  onToggle: () => void;
}) {
  const now = courses.filter((x) => x.enrolled).length;
  const shown = all ? courses : courses.slice(0, COURSE_LIMIT);
  return (
    <div className="course-chips">
      <div className="chips-head">
        <span>対象の科目</span>
        <span>
          取得済み <b>{courses.length - now}科目</b>
        </span>
        {now > 0 && (
          <span>
            履修中 <b className="now">{now}科目</b>
          </span>
        )}
      </div>
      <div className="chips">
        {shown.map((x) => (
          <div className={"chip" + (x.enrolled ? " now" : "")} key={x.id}>
            <span className="chip-name">
              {x.enrolled && <small>履修中</small>}
              <span>{x.name}</span>
            </span>
            <span className="chip-credits">{x.credits}</span>
          </div>
        ))}
      </div>
      {courses.length > COURSE_LIMIT && (
        <button type="button" className="text-button" onClick={onToggle}>
          {all ? "折りたたむ" : `すべての科目を表示（${courses.length}科目）`}
        </button>
      )}
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
