import { z } from "zod";
export const decimal = z.string().regex(/^\d+(\.\d{1,2})?$/);
const sourceSchema = z.object({
  url: z.url(),
  pages: z.array(z.number().int().positive()),
  checkedAt: z.string(),
  status: z.enum(["verified", "pending"]),
  sha256: z.string().optional(),
});
const selectorSchema = z
  .object({
    sections: z.array(z.string()).optional(),
    kinds: z.array(z.string()).optional(),
    courseIds: z.array(z.string()).optional(),
    external: z.boolean().optional(),
  })
  .strict();
export type Selector = z.infer<typeof selectorSchema>;
export type Expression =
  | { type: "credits"; minimum: string; selector: Selector }
  | { type: "count"; minimum: number; selector: Selector }
  | { type: "allCourses"; courseIds: string[] }
  | { type: "and" | "or"; children: Expression[] };
const expressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.union([
    z
      .object({
        type: z.literal("credits"),
        minimum: decimal,
        selector: selectorSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("count"),
        minimum: z.number().int().nonnegative(),
        selector: selectorSchema,
      })
      .strict(),
    z
      .object({ type: z.literal("allCourses"), courseIds: z.array(z.string()) })
      .strict(),
    z
      .object({
        type: z.enum(["and", "or"]),
        children: z.array(expressionSchema).min(1),
      })
      .strict(),
  ]),
);
export const curriculumSchema = z.object({
  totalRuleId: z.string(),
  id: z.string(),
  university: z.string(),
  faculty: z.string(),
  department: z.string(),
  entryYear: z.number(),
  label: z.string(),
  version: z.string(),
  publicationYear: z.number().nullable(),
  revisionYear: z.number().nullable(),
  publicationYearNote: z.string(),
  applicability: z.string(),
  releaseStatus: z.enum(["verified", "preparing", "unsupported", "fixture"]),
  source: sourceSchema,
  courses: z.array(
    z.object({
      id: z.string(),
      officialCode: z.string().nullable(),
      name: z.string(),
      aliases: z.array(z.string()),
      university: z.string(),
      faculty: z.string(),
      department: z.string(),
      source: sourceSchema,
    }),
  ),
  placements: z.array(
    z.object({
      courseId: z.string(),
      credits: decimal,
      section: z.string(),
      kind: z.enum(["required", "selective", "elective", "excluded"]),
      eligible: z.boolean(),
      external: z.boolean(),
    }),
  ),
  equivalences: z.array(
    z.object({ from: z.string(), to: z.string(), source: sourceSchema }),
  ),
  caps: z.array(
    z.object({
      id: z.string(),
      maximum: decimal,
      selector: selectorSchema,
      source: sourceSchema,
    }),
  ),
  rules: z.array(
    z.object({
      id: z.string(),
      curriculumId: z.string(),
      entryYear: z.number(),
      department: z.string(),
      assessment: z.enum(["graduation", "progression", "thesis-entry"]),
      label: z.string(),
      source: sourceSchema,
      expression: expressionSchema,
    }),
  ),
  externalConditions: z.array(z.string()),
  unresolved: z.array(z.string()),
  excludedExternal: z.array(
    z.object({ name: z.string(), department: z.string() }),
  ),
});
export type Curriculum = z.infer<typeof curriculumSchema>;
export type Placement = Curriculum["placements"][number];
export type GradeStatus =
  "earned" | "failed" | "enrolled" | "ungraded" | "unknown";
export interface Grade {
  id: string;
  courseId: string;
  name: string;
  code: string;
  credits: string;
  evaluation: string;
  year: string;
  status: GradeStatus;
  confirmed: boolean;
  provenance: { kind: "pdf" | "manual" | "demo"; page?: number; raw: string };
}
export type CheckStatus = "met" | "unmet" | "review";
export interface RuleResult {
  id: string;
  label: string;
  status: CheckStatus;
  metric?: "credits" | "courses";
  earned?: number;
  required?: number;
  missing?: number;
  missingCourses?: string[];
  reason: string;
  source: Curriculum["source"];
}
export const units = (s: string): number => {
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error("単位数は小数第2位までの非負数にしてください");
  const [a, b = ""] = s.split(".");
  const v = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(v) || v > 100000)
    throw new Error("単位数が範囲外です");
  return v;
};
export const creditText = (n: number) => String(n / 100);
