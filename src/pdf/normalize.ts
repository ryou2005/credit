import { matchCourse } from "../domain/engine";
import type { Curriculum, Grade } from "../domain/schema";
export interface TextLine {
  page: number;
  text: string;
}
export function parseTextLines(lines: TextLine[], c: Curriculum) {
  const grades: Grade[] = [];
  const identifiers = new Set<string>();
  for (const line of lines) {
    const normalized = line.text.normalize("NFKC").trim();
    for (const id of normalized.match(/\b[A-Za-z]\d{6}\b/g) ?? [])
      identifiers.add(id.toUpperCase());
    if (!normalized || /^学籍番号\s*[:：]?\s*[A-Za-z]\d{6}$/.test(normalized))
      continue;
    // Explicit interchange layout only; real Ku-port columns are not yet verified.
    // Name | code | credits | evaluation | year | status. Never infer pass from a letter grade.
    const cells = normalized.split(/[|\t]/).map((s) => s.trim());
    const structured = cells.length === 6;
    const course = structured
      ? matchCourse(c, cells[0], cells[1])
      : matchCourse(c, normalized);
    const placement = c.placements.find((p) => p.courseId === course?.id);
    const statuses: Record<string, Grade["status"]> = {
      修得: "earned",
      不合格: "failed",
      履修中: "enrolled",
      未評価: "ungraded",
    };
    grades.push({
      id: crypto.randomUUID(),
      courseId: course?.id ?? "",
      name: structured ? cells[0] : normalized,
      code: structured ? cells[1] : "",
      credits: structured ? cells[2] : (placement?.credits ?? ""),
      evaluation: structured ? cells[3] : "",
      year: structured ? cells[4] : "",
      status: structured ? (statuses[cells[5]] ?? "unknown") : "unknown",
      confirmed: false,
      provenance: { kind: "pdf", page: line.page, raw: line.text },
    });
  }
  return { grades, identifiers: [...identifiers] };
}
export function identityIssue(input: string, ids: string[]) {
  return ids.length > 0 && (ids.length !== 1 || ids[0] !== input)
    ? "PDF内の学籍番号と入力が一致しません。入力を修正するか、本人のPDFを取り込み直してください。"
    : null;
}
export function validatePdfFile(file: {
  size: number;
  name: string;
  type: string;
}) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error(
      "20MBを超えています。成績ページだけをPDF保存し直すか、手入力してください。",
    );
  if (!file.size)
    throw new Error("空のファイルです。PDFを保存し直してください。");
  if (!file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("PDFを選択してください。手入力でも進められます。");
}
