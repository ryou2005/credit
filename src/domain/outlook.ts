import { evaluateCurriculum } from "./engine";
import type { Curriculum, Grade } from "./schema";

type Options = NonNullable<Parameters<typeof evaluateCurriculum>[2]>;

// One grade list assessed three ways: what is passed now (the official
// reading), after this term's 履修中 courses (`projected`), and after that
// with the 卒業論文 also done (`planned`). The result screen counts the
// shortfall on `planned`: 履修中 and the 卒論 are taken as given.
export function evaluateOutlook(
  c: Curriculum,
  grades: Grade[],
  options: Options = {},
) {
  const now = evaluateCurriculum(c, grades, options);
  const projected = evaluateCurriculum(c, grades, {
    ...options,
    countEnrolled: true,
  });
  const thesis = c.placements
    .filter(
      (p) =>
        p.section === "thesis" &&
        p.eligible &&
        !projected.accepted.includes(p.courseId),
    )
    .map((p) => p.courseId);
  const planned = thesis.length
    ? evaluateCurriculum(c, grades, {
        ...options,
        countEnrolled: true,
        assume: thesis,
      })
    : projected;
  return { ...now, projected, planned };
}
export type Outlook = ReturnType<typeof evaluateOutlook>;
