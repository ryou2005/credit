import { masterKey, type CourseMaster } from "./master";
import { units, type Grade } from "./schema";

// Grade scale of gpa_2024.pdf, best first. A+〜D pass, only F fails.
export const GRADE_SCALE = ["A+", "A", "B", "C", "D", "F"] as const;
export type Evaluation = (typeof GRADE_SCALE)[number];
const rank = (e: string) => GRADE_SCALE.indexOf(e as Evaluation);

export interface FailedCourse {
  name: string;
  credits: number | null;
  // An F course currently being retaken (※ row); still 落単 until graded.
  retaking: boolean;
}
export interface GradeSummary {
  courses: number;
  earned: number;
  failed: number;
  failedCourses: FailedCourse[];
  // Courses being taken and not yet passed, retakes of F courses included.
  enrolled: number;
  byGrade: Record<Evaluation, number>;
  // Courses whose credits are blank or invalid; their credits are not summed.
  unknownCredits: string[];
}

// Same course = same curriculum course, else same master entry, else same name.
const courseKey = (g: Grade) =>
  g.courseId
    ? `c:${g.courseId}`
    : g.masterId
      ? `m:${g.masterId}`
      : `n:${masterKey(g.name)}`;

const creditsOf = (g: Grade, master?: CourseMaster) => {
  const fromMaster = master?.courses.find((x) => x.id === g.masterId)?.credits;
  for (const s of [g.credits, fromMaster ?? ""]) {
    try {
      return units(s);
    } catch {
      // try the next source
    }
  }
  return null;
};

// Summary of the grade list as read/entered (unconfirmed rows included), in
// hundredths of a credit like the engine. Follows gpa_2024.pdf: a course taken
// more than once counts once, with its best evaluation — so an F later passed
// is not 落単, and only courses whose best evaluation is still F are.
export function summarizeGrades(
  grades: Grade[],
  master?: CourseMaster,
): GradeSummary {
  const byCourse = new Map<string, Grade[]>();
  for (const g of grades) {
    if (!g.name.trim() && !g.courseId) continue;
    const k = courseKey(g);
    byCourse.set(k, [...(byCourse.get(k) ?? []), g]);
  }
  const summary: GradeSummary = {
    courses: byCourse.size,
    earned: 0,
    failed: 0,
    failedCourses: [],
    enrolled: 0,
    byGrade: { "A+": 0, A: 0, B: 0, C: 0, D: 0, F: 0 },
    unknownCredits: [],
  };
  for (const attempts of byCourse.values()) {
    const graded = attempts
      .filter((g) => rank(g.evaluation) >= 0)
      .sort((a, b) => rank(a.evaluation) - rank(b.evaluation));
    // Rows without a scale grade (manual) fall back to the chosen status.
    const passed =
      graded.find((g) => g.evaluation !== "F") ??
      attempts.find((g) => !graded.includes(g) && g.status === "earned");
    const failed =
      graded.find((g) => g.evaluation === "F") ??
      attempts.find((g) => !graded.includes(g) && g.status === "failed");
    const enrolled = attempts.find((g) => g.status === "enrolled");
    const decisive = passed ?? failed ?? enrolled;
    if (!decisive) continue;
    const credits = creditsOf(decisive, master);
    if (credits === null) summary.unknownCredits.push(decisive.name);
    const n = credits ?? 0;
    const best = graded[0];
    if (best && (passed ? best === passed : best === failed))
      summary.byGrade[best.evaluation as Evaluation] += n;
    if (passed) {
      summary.earned += n;
      continue;
    }
    if (failed) {
      summary.failed += n;
      summary.failedCourses.push({
        name: failed.name,
        credits,
        retaking: !!enrolled,
      });
    }
    // Like Ku-port's 履修中単位, this includes F courses now being retaken.
    if (enrolled) summary.enrolled += n;
  }
  return summary;
}
