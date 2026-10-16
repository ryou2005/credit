import type { Curriculum, Grade } from "../domain/schema";
// Synthetic records, not real student records. Imported only in Vite development builds.
export function demoGrades(c: Curriculum, complete = false): Grade[] {
  const chosen = complete
    ? c.placements.filter((p) => p.eligible)
    : c.placements
        .filter(
          (p) =>
            p.kind === "required" &&
            !p.section.startsWith("III") &&
            p.section !== "thesis",
        )
        .concat(c.placements.filter((p) => p.section === "I-a").slice(0, 5));
  return chosen.map((p, i) => ({
    id: `demo-${i}`,
    courseId: p.courseId,
    name: c.courses.find((x) => x.id === p.courseId)!.name,
    code: "",
    credits: p.credits,
    evaluation: "架空データ：修得",
    year: "2025",
    status: "earned",
    confirmed: true,
    provenance: { kind: "demo", raw: "架空の検証用データ" },
  }));
}
