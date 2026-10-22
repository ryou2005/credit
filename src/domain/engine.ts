import { validateCurriculum } from "./validate";
import { isExcludedSimilar, type CourseMaster } from "./master";
import {
  units,
  type Curriculum,
  type Grade,
  type Placement,
  type Selector,
  type Expression,
  type RuleResult,
  type CheckStatus,
} from "./schema";
export const normalizeName = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, " ");
export function matchCourse(c: Curriculum, name: string, code = "") {
  const normalized = normalizeName(name);
  const matches = c.courses.filter((x) =>
    code
      ? x.officialCode === code
      : x.name === name ||
        normalizeName(x.name) === normalized ||
        x.aliases.some((a) => normalizeName(a) === normalized),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
// A course of another 情報学部 department taken under the PDF's 他学科 heading:
// it counts in the 学部枠 as an elective (p4 注1), capped by the curriculum's
// external cap. Similar courses listed in 注1 never count.
function externalPlacement(
  c: Curriculum,
  master: CourseMaster | undefined,
  g: Grade,
): { placement?: Placement; excluded?: boolean } {
  const x = master?.courses.find((m) => m.id === g.masterId);
  if (!master || !x || !g.otherDepartment) return {};
  if (x.department === c.department || !["II-b", "III"].includes(x.group))
    return {};
  if (isExcludedSimilar(master, c, x)) return { excluded: true };
  return {
    placement: {
      courseId: `external:${x.id}`,
      credits: x.credits,
      section: "external",
      kind: "elective",
      eligible: true,
      external: true,
    },
  };
}
type Assessment = Curriculum["rules"][number]["assessment"];
export const matches = (p: Placement, s: Selector) =>
  (!s.sections || s.sections.includes(p.section)) &&
  (!s.kinds || s.kinds.includes(p.kind)) &&
  (!s.courseIds || s.courseIds.includes(p.courseId)) &&
  (s.external === undefined || s.external === p.external);
export function evaluateCurriculum(
  input: Curriculum,
  grades: Grade[],
  options: {
    allowFixture?: boolean;
    documentIssues?: string[];
    master?: CourseMaster;
  } = {},
) {
  const c = validateCurriculum(input);
  if (
    c.releaseStatus !== "verified" &&
    !(options.allowFixture && c.releaseStatus === "fixture")
  )
    throw new Error("検証済みのカリキュラムではありません");
  const issues: string[] = [...(options.documentIssues ?? [])],
    notes: string[] = [];
  const accepted = new Map<string, Placement>();
  for (const g of grades) {
    const external = g.courseId ? {} : externalPlacement(c, options.master, g);
    const original = external.placement
      ? { source: { status: "verified" } }
      : c.courses.find((x) => x.id === g.courseId);
    const eq = c.equivalences.find(
      (x) => x.from === g.courseId && x.source.status === "verified",
    );
    const p =
      external.placement ??
      c.placements.find((x) => x.courseId === (eq?.to ?? g.courseId));
    if (!g.confirmed) {
      issues.push(`${g.name || "名称未入力"}：読み取り・入力内容が未確認`);
      continue;
    }
    if (!["earned", "failed", "enrolled", "ungraded"].includes(g.status)) {
      issues.push(
        `${g.name}：評価・修得状況が未確認（${g.evaluation || "評価なし"}）`,
      );
      continue;
    }
    if (g.status !== "earned") {
      notes.push(`${g.name}：修得済みではないため算入しません`);
      continue;
    }
    if (external.excluded) {
      notes.push(
        `${g.name}：他学科の類似科目のため学部枠に算入しません（p4 注1）`,
      );
      continue;
    }
    if (!original || !p) {
      issues.push(
        g.otherDepartment
          ? `${g.name}：他学科の科目ですが、開講学科・科目を特定できません。自動算入しません`
          : `${g.name || "名称未入力"}：未知の科目・分類。自動算入しません`,
      );
      continue;
    }
    if (!p.eligible) {
      notes.push(`${g.name}：卒業単位への算入対象外`);
      continue;
    }
    try {
      if (units(g.credits) !== units(p.credits)) throw new Error();
    } catch {
      issues.push(`${g.name}：単位数がカリキュラムと一致しません`);
      continue;
    }
    if (original.source.status !== "verified") {
      issues.push(`${g.name}：根拠未確認`);
      continue;
    }
    if (accepted.has(p.courseId))
      notes.push(`${g.name}：重複・再履修は1科目分のみ算入`);
    accepted.set(p.courseId, p);
  }
  const rows = [...accepted.values()].sort((a, b) =>
    a.courseId.localeCompare(b.courseId),
  );
  const sum = (s: Selector) => {
    const selected = rows.filter((p) => matches(p, s));
    let value = selected.reduce((a, p) => a + units(p.credits), 0);
    for (const cap of c.caps) {
      const group = selected.filter((p) => matches(p, cap.selector));
      const actual = group.reduce((a, p) => a + units(p.credits), 0);
      value -= Math.max(0, actual - units(cap.maximum));
    }
    return value;
  };
  const hasIssues = issues.length > 0;
  const expr = (e: Expression): Omit<RuleResult, "id" | "label" | "source"> => {
    if (e.type === "credits" || e.type === "count") {
      const earned =
        e.type === "credits"
          ? sum(e.selector)
          : rows.filter((p) => matches(p, e.selector)).length;
      const required = e.type === "credits" ? units(e.minimum) : e.minimum;
      return {
        status: earned >= required ? "met" : hasIssues ? "review" : "unmet",
        metric: e.type === "credits" ? "credits" : "courses",
        earned,
        required,
        missing: Math.max(0, required - earned),
        reason:
          earned >= required
            ? "確認済みデータで条件を満たしています"
            : hasIssues
              ? "未確認データが不足分に影響する可能性があります"
              : "確認済みデータでは必要量に達していません",
      };
    }
    if (e.type === "allCourses") {
      const missing = e.courseIds.filter((id) => !accepted.has(id));
      return {
        status: missing.length ? (hasIssues ? "review" : "unmet") : "met",
        missingCourses: missing,
        reason: missing.length
          ? `${missing.length}科目の修得を確認できません`
          : "指定した必修科目をすべて確認しました",
      };
    }
    const children = e.children.map(expr);
    let status: CheckStatus;
    if (e.type === "and")
      status = children.some((r) => r.status === "unmet")
        ? "unmet"
        : children.some((r) => r.status === "review")
          ? "review"
          : "met";
    else
      status = children.some((r) => r.status === "met")
        ? "met"
        : children.some((r) => r.status === "review")
          ? "review"
          : "unmet";
    return { status, reason: children.map((r) => r.reason).join(" / ") };
  };
  const evaluate = (assessment: Assessment) =>
    c.rules
      .filter((r) => r.assessment === assessment)
      .map((r) => ({
        id: r.id,
        label: r.label,
        source: r.source,
        expression: r.expression,
        ...(r.source.status === "verified"
          ? expr(r.expression)
          : {
              status: "review" as const,
              reason: "判定ルールの根拠が未確認です",
            }),
      }));
  const capPending = c.caps.some((cap) => cap.source.status !== "verified");
  if (capPending) issues.push("算入上限の根拠が未確認です");
  // Global uncertainty takes precedence: the confirmed total is a lower bound, never an inferred pass.
  const overall = (rs: ReturnType<typeof evaluate>): CheckStatus =>
    issues.length || rs.some((r) => r.status === "review")
      ? "review"
      : rs.some((r) => r.status === "unmet")
        ? "unmet"
        : "met";
  const results = evaluate("graduation");
  const thesisResults = evaluate("thesis-entry");
  return {
    status: overall(results),
    earned: sum({}),
    results,
    // Empty when the curriculum defines no thesis-entry rules.
    thesisEntry: { status: overall(thesisResults), results: thesisResults },
    // Credits of the counted courses matching a selector (caps applied).
    creditsFor: sum,
    issues,
    notes,
    accepted: [...accepted.keys()],
    caps: c.caps.map((cap) => ({
      id: cap.id,
      actual: rows
        .filter((p) => matches(p, cap.selector))
        .reduce((a, p) => a + units(p.credits), 0),
      maximum: units(cap.maximum),
    })),
  };
}
