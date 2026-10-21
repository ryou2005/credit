import { matchCourse } from "../domain/engine";
import { lookupMaster, type CourseMaster } from "../domain/master";
import type { Curriculum, Grade } from "../domain/schema";
import { courseMaster } from "../data/registry";

export interface TextItem {
  str: string;
  x: number;
  width: number;
}
export interface TextRow {
  page: number;
  y: number;
  text: string;
  items: TextItem[];
}

// Official grade definition (gpa_2024.pdf): A+,A,B,C,D are passing; only F fails.
const PASS = new Set(["A+", "A", "B", "C", "D"]);
const statuses: Record<string, Grade["status"]> = {
  修得: "earned",
  不合格: "failed",
  履修中: "enrolled",
  未評価: "ungraded",
};
const CREDIT = /^\d+(\.\d{1,2})?$/;
const YEAR = /^\d{4}$/;
const EVAL = /^(A\+|A|B|C|D|F)$/;
const IDENT = /\b([A-Za-z]\d{6})\b/g;

// Page titles that are summaries, not course detail — never parse as grades.
const SKIP_PAGE = /GPA推移表|単位修得状況表/;
const DETAIL_PAGE = /成績一覧表/;

// Classification headers inside the detail table (used as breadcrumb/context only;
// the engine still classifies by the course master, not by these).
// Tested against NFKC-normalized text (Roman numerals/fullwidth become ASCII).
const GROUP = /第[IVX]+群/;
const CATEGORY =
  /総合文化科目|外国語科目|保健体育科目|キャリア支援科目|専門共通科目|共通基礎科目|専門基礎科目|専門科目|数理.?データサイエンス/;
const KIND = /^(必修|選択必修|選択)$|選必|区分/;
// Heading of courses taken from another 情報学部 department (e.g. 情報系他学科科目).
// The PDF never names the offering department; outside this heading a course is
// the student's own department's.
const OTHER_DEPARTMENT = /他学科/;

interface Columns {
  name: string;
  enrolled: boolean;
  credit: string;
  evaluation: string;
  year: string;
  term: string;
  teacherOnly: boolean;
}

// Find the detail header row and learn each column's x position from it.
function anchors(rows: TextRow[]) {
  for (const r of rows) {
    const find = (label: string) =>
      r.items.find((i) => i.str.replace(/\s+/g, "") === label)?.x;
    const credit = find("単位数");
    const evaluation = find("評価");
    const year = find("年度");
    const term = find("学期");
    if (credit && evaluation && year && term)
      return { credit, evaluation, year, term };
  }
  return null;
}

// Slice one row into columns using the learned x anchors. Blank cells stay blank
// (never shift a later column left into an empty one).
function slice(
  row: TextRow,
  a: NonNullable<ReturnType<typeof anchors>>,
): Columns {
  const nameMax = a.credit - 30;
  const nameItems: string[] = [];
  const cols = { credit: "", evaluation: "", year: "", term: "", teacher: "" };
  let nonNameItems = 0;
  for (const it of row.items) {
    const s = it.str.trim();
    if (!s) continue;
    if (it.x < nameMax) {
      nameItems.push(it.str);
      continue;
    }
    nonNameItems++;
    const targets: [keyof typeof cols, number][] = [
      ["credit", a.credit],
      ["evaluation", a.evaluation],
      ["year", a.year],
      ["term", a.term],
      ["teacher", a.term + 40],
    ];
    const [key] = targets.reduce((best, t) =>
      Math.abs(it.x - t[1]) < Math.abs(it.x - best[1]) ? t : best,
    );
    cols[key] = cols[key] ? `${cols[key]} ${s}` : s;
  }
  let name = nameItems.join("").replace(/\s+/g, " ").trim();
  const enrolled = /^※/.test(name) || nameItems.some((s) => s.trim() === "※");
  name = name.replace(/^※\s*/, "").trim();
  return {
    name,
    enrolled,
    credit: CREDIT.test(cols.credit) ? cols.credit : "",
    evaluation: EVAL.test(cols.evaluation) ? cols.evaluation : "",
    year: YEAR.test(cols.year) ? cols.year : "",
    term: cols.term,
    // A lone fragment in the teacher column is a wrapped teacher name, not a course.
    teacherOnly: !name && !!cols.teacher && nonNameItems > 0,
  };
}

function draftStatus(c: Columns): Grade["status"] {
  if (c.enrolled) return "enrolled";
  if (c.evaluation === "F") return "failed";
  if (PASS.has(c.evaluation) && c.credit) return "earned";
  return "unknown";
}

export function parseTextLines(
  rows: TextRow[],
  c: Curriculum,
  master: CourseMaster = courseMaster,
) {
  const grades: Grade[] = [];
  const identifiers = new Set<string>();
  for (const r of rows)
    for (const m of r.text.normalize("NFKC").matchAll(IDENT))
      identifiers.add(m[1].toUpperCase());

  const byPage = new Map<number, TextRow[]>();
  for (const r of rows)
    (byPage.get(r.page) ?? byPage.set(r.page, []).get(r.page)!).push(r);

  // Breadcrumb carried across page breaks; higher levels reset lower ones.
  const crumb = { group: "", category: "", kind: "" };
  const breadcrumb = () =>
    [crumb.group, crumb.category, crumb.kind].filter(Boolean).join(" > ");
  const push = (name: string, row: TextRow, extra: Partial<Grade>) => {
    const b = breadcrumb();
    grades.push({
      id: crypto.randomUUID(),
      courseId: "",
      name,
      code: "",
      credits: "",
      evaluation: "",
      year: "",
      status: "unknown",
      confirmed: false,
      ...extra,
      provenance: {
        kind: "pdf",
        page: row.page,
        raw: b ? `[${b}] ${row.text}` : row.text,
      },
    });
  };

  for (const [page, pageRows] of [...byPage].sort((a, b) => a[0] - b[0])) {
    const title = pageRows.map((r) => r.text).join(" ");
    if (SKIP_PAGE.test(title) && !DETAIL_PAGE.test(title)) continue;
    const a = anchors(pageRows);

    for (const row of pageRows) {
      const text = row.text.normalize("NFKC").trim();
      if (!text) continue;

      // Column (real Ku-port) path when the page exposes a header row.
      if (a) {
        const cols = slice(row, a);
        if (cols.teacherOnly) {
          const last = grades[grades.length - 1];
          if (last) last.provenance.raw += " / " + text;
          continue;
        }
        const isCourse = !!cols.year && !!cols.name;
        if (!isCourse) {
          if (GROUP.test(text)) {
            crumb.group = text;
            crumb.category = crumb.kind = "";
          } else if (CATEGORY.test(text)) {
            crumb.category = text;
            crumb.kind = "";
          } else if (KIND.test(text)) {
            crumb.kind = text;
          }
          continue; // headers / titles / notes / identity / footers are not grades
        }
        const otherDepartment = OTHER_DEPARTMENT.test(crumb.category);
        // Another department's course never maps onto this curriculum, even
        // with an identical name (e.g. 機械学習 of 情報科学科 vs this 第Ⅲ群).
        const found = lookupMaster(master, c, cols.name, { otherDepartment });
        // Own-department master entries share the curriculum's course IDs, so a
        // master hit (whitespace-insensitive) also identifies the course.
        const course = otherDepartment
          ? undefined
          : (matchCourse(c, cols.name) ??
            c.courses.find((x) => x.id === found.entry?.id));
        // The PDF leaves an F row's credit blank: fill it from the course
        // master. A printed credit is kept as-is; the engine checks it.
        const credits = cols.credit || (found.entry?.credits ?? "");
        push(cols.name, row, {
          courseId: course?.id ?? "",
          masterId: found.entry?.id ?? "",
          otherDepartment,
          credits,
          creditSource: cols.credit ? "pdf" : credits ? "master" : undefined,
          evaluation: cols.evaluation,
          year: cols.year,
          status: draftStatus(cols),
        });
        continue;
      }

      // Fallback for PDFs without a header row: explicit interchange format or
      // whole-line name match. Not Ku-port; used by synthetic fixtures/tests.
      if (/^学籍番号\s*[:：]?\s*[A-Za-z]\d{6}$/.test(text)) continue;
      const cells = text.split(/[|\t]/).map((s) => s.trim());
      if (cells.length === 6) {
        const course = matchCourse(c, cells[0], cells[1]);
        push(cells[0], row, {
          courseId: course?.id ?? "",
          code: cells[1],
          credits: cells[2],
          evaluation: cells[3],
          year: cells[4],
          status: statuses[cells[5]] ?? "unknown",
        });
      } else {
        const course = matchCourse(c, text);
        const placement = c.placements.find((p) => p.courseId === course?.id);
        push(text, row, {
          courseId: course?.id ?? "",
          credits: placement?.credits ?? "",
        });
      }
    }
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
