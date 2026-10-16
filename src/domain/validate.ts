import { curriculumSchema, type Curriculum, type Expression } from "./schema";
export function validateCurriculum(input: unknown): Curriculum {
  const c = curriculumSchema.parse(input);
  const ids = new Set(c.courses.map((x) => x.id));
  if (
    ids.size !== c.courses.length ||
    new Set(c.placements.map((x) => x.courseId)).size !== c.placements.length
  )
    throw new Error("科目IDが重複しています");
  if (c.placements.some((p) => !ids.has(p.courseId)))
    throw new Error("科目マスターにない科目の配置");
  const placed = new Set(c.placements.map((p) => p.courseId));
  const visit = (e: Expression) => {
    if (e.type === "and" || e.type === "or") {
      e.children.forEach(visit);
      return;
    }
    const list =
      e.type === "allCourses"
        ? e.courseIds
        : "selector" in e
          ? e.selector.courseIds
          : undefined;
    if (list?.some((id) => !placed.has(id)))
      throw new Error("ルールに未知の科目");
  };
  if (new Set(c.rules.map((r) => r.id)).size !== c.rules.length)
    throw new Error("ルールIDが重複");
  c.rules.forEach((r) => {
    if (
      r.curriculumId !== c.id ||
      r.entryYear !== c.entryYear ||
      r.department !== c.department
    )
      throw new Error("別カリキュラムのルールが混入");
    visit(r.expression);
  });
  c.equivalences.forEach((e) => {
    if (
      !placed.has(e.to) ||
      e.from === e.to ||
      c.equivalences.some((x) => x.from === e.to) ||
      c.equivalences.filter((x) => x.from === e.from).length !== 1
    )
      throw new Error("曖昧・連鎖する代替対応は未対応");
  });
  // Overlapping caps or partial selector/cap intersections require allocation, intentionally unsupported.
  const match = (
    p: Curriculum["placements"][number],
    s: {
      sections?: string[];
      kinds?: string[];
      courseIds?: string[];
      external?: boolean;
    },
  ) =>
    (!s.sections || s.sections.includes(p.section)) &&
    (!s.kinds || s.kinds.includes(p.kind)) &&
    (!s.courseIds || s.courseIds.includes(p.courseId)) &&
    (s.external === undefined || s.external === p.external);
  for (const p of c.placements)
    if (c.caps.filter((cap) => match(p, cap.selector)).length > 1)
      throw new Error("重なる算入上限は未対応");
  const validateCap = (e: Expression) => {
    if (e.type === "and" || e.type === "or")
      return e.children.forEach(validateCap);
    if (e.type !== "credits") return;
    for (const cap of c.caps) {
      const capped = c.placements.filter((p) => match(p, cap.selector));
      const n = capped.filter((p) => match(p, e.selector)).length;
      if (n > 0 && n < capped.length)
        throw new Error("複数区分への上限単位配分は未対応");
    }
  };
  c.rules.forEach((r) => validateCap(r.expression));
  return c;
}
