import type { Curriculum, Grade } from "../src/domain/schema";
// Synthetic records, not real student records: every eligible course earned.
export function syntheticGrades(c: Curriculum): Grade[] {
  return c.placements
    .filter((p) => p.eligible)
    .map((p, i) => ({
      id: `synthetic-${i}`,
      courseId: p.courseId,
      name: c.courses.find((x) => x.id === p.courseId)!.name,
      code: "",
      credits: p.credits,
      evaluation: "架空データ：修得",
      year: "2025",
      status: "earned",
      confirmed: true,
      provenance: { kind: "manual", raw: "架空の検証用データ" },
    }));
}
