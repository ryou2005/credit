// Build src/data/course-master.json from the official 2024-entry curriculum tables
// (学則別表第１) of the four 情報学部 departments.
//
//   node scripts/build-course-master.mjs <dir containing the PDFs> [--check]
//
// The PDFs are not stored in Git. Download them from the URLs in SOURCES; the
// SHA-256 must match, so a revised PDF is never mixed in silently. Group
// (群) and section (区分) come from the table's ruled cells: a horizontal rule
// starting at the table's left edge closes a 群, one starting at the next
// column closes a 区分. --check prints the rows instead of writing the file.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const BASE =
  "https://www.kogakuin.ac.jp/student/syllabus_binran/u53qdr00000037u3-att/";
const CHECKED_AT = "2026-10-21";
const SOURCES = [
  {
    department: "ic",
    label: "情報通信工学科",
    file: "2025info1.pdf",
    sha256: "4a256a9e2a3e44e6fa7a0c12cdd02f979e02cdf1d762130879619b857a8c9616",
  },
  {
    department: "cs",
    label: "コンピュータ科学科",
    file: "2025info2.pdf",
    sha256: "07e67166639650a0b0535b7976cc27d8870f1f61e8a89b7c8c3628b0b4d67df4",
  },
  {
    department: "id",
    label: "情報デザイン学科",
    file: "2025info3.pdf",
    sha256: "88b9b457857e3058524b4109782ce9d964adaa355010b462f2d432d35ac04e68",
  },
  {
    department: "is",
    label: "情報科学科",
    file: "2025info4re1.pdf",
    sha256: "8b47f36c0431e5130660752aa00602ff7c046174d867b14d9f1733e497ca9d07",
  },
];
const TABLE_PAGES = [2, 3];
const NUMBER = /^\d+(\.\d)?$/;
const near = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance;

async function readTable(page) {
  const content = await page.getTextContent();
  const items = content.items
    .filter((i) => "str" in i && i.str.trim())
    .map((i) => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
  const ops = await page.getOperatorList();
  const vertical = new Set();
  const horizontal = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== OPS.constructPath) continue;
    const [x1, y1, x2, y2] = Array.from(ops.argsArray[i][2]);
    if (x2 - x1 < 1 && y2 - y1 > 100) vertical.add(Math.round(x1));
    else if (y2 - y1 < 1 && x2 - x1 > 100) horizontal.push({ x: x1, y: y1 });
  }
  const header = items.filter((i) =>
    near(
      i.y,
      Math.max(...items.filter((h) => h.s === "授業科目").map((h) => h.y)),
      3,
    ),
  );
  const col = (label) => header.find((h) => h.s === label)?.x;
  const lines = [...vertical].sort((a, b) => a - b);
  const [left, groupRight] = lines;
  const nameLeft = Math.max(...lines.filter((x) => x < col("授業科目")));
  const nameRight = Math.max(...lines.filter((x) => x < col("選必種別")));
  const headerY = header[0].y;
  // Bands are listed top to bottom; each starts below the previous rule.
  const bands = (x) =>
    horizontal
      .filter((h) => near(h.x, x) && h.y < headerY)
      .map((h) => h.y)
      .sort((a, b) => b - a)
      .filter((y, i, a) => i === 0 || !near(y, a[i - 1], 1));
  const label = (cuts, y, from, to) => {
    const top = cuts.filter((c) => c > y).at(-1) ?? headerY;
    const bottom = cuts.find((c) => c < y) ?? 0;
    return items
      .filter(
        (i) => i.x >= from - 1 && i.x < to - 1 && i.y < top && i.y > bottom,
      )
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((i) => i.s)
      .join("");
  };
  const groupCuts = bands(left);
  const sectionCuts = bands(groupRight);
  const byY = new Map();
  for (const i of items) {
    if (i.y >= headerY - 1) continue;
    const y = Math.round(i.y / 3) * 3;
    (byY.get(y) ?? byY.set(y, []).get(y)).push(i);
  }
  const rows = [];
  for (const [, row] of [...byY].sort((a, b) => b[0] - a[0])) {
    row.sort((a, b) => a.x - b.x);
    const at = (label) => {
      const x = col(label);
      const hit = row
        .filter((i) => i.x > nameRight)
        .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
      return hit && Math.abs(hit.x - x) < 14 ? hit.s : "";
    };
    const name = row
      .filter((i) => i.x >= nameLeft - 1 && i.x < nameRight - 1)
      .map((i) => i.s)
      .join("");
    const credits = at("単位数");
    const y = row[0].y;
    rows.push({
      name,
      kind: at("選必種別"),
      form: at("授業形態"),
      year: at("学年"),
      term: at("履修期"),
      credits: NUMBER.test(credits) ? credits : "",
      group: label(groupCuts, y, left, groupRight),
      // The "a）/b）" marker sits on the column boundary, so read up to the name column.
      section: label(sectionCuts, y, groupRight, nameLeft),
    });
  }
  // A long name can wrap so that its text and its other cells land on adjacent
  // rows; merge such a pair (one row has a name but no credits, the next the reverse).
  for (let i = 0; i + 1 < rows.length; i++) {
    const [a, b] = [rows[i], rows[i + 1]];
    if (
      !!a.name !== !!b.name &&
      !!a.credits !== !!b.credits &&
      !!a.name === !a.credits
    ) {
      for (const k of Object.keys(a)) a[k] ||= b[k];
      rows.splice(i + 1, 1);
    }
  }
  return rows;
}

// 【第Ⅱ群】専門共通科目 + b）専門基礎科目 → II-b
function groupId(group, section) {
  const g = group.normalize("NFKC");
  const s = section.normalize("NFKC");
  if (/第I群/.test(g)) return "I";
  if (/第II群/.test(g))
    return /b\)/.test(s) ? "II-b" : /a\)/.test(s) ? "II-a" : "";
  if (/第III群/.test(g)) return "III";
  if (/その他/.test(g)) return "other";
  return "";
}

const [dir, flag] = process.argv.slice(2);
if (!dir) throw new Error("usage: build-course-master.mjs <pdf dir> [--check]");
const curriculum = JSON.parse(
  await readFile(
    new URL("../src/data/kogakuin-2024.json", import.meta.url),
    "utf8",
  ),
);
const norm = (s) => s.normalize("NFKC").replace(/\s+/g, "");
const csByName = new Map(curriculum.courses.map((c) => [norm(c.name), c]));
const courses = [];
const problems = [];
for (const source of SOURCES) {
  const data = await readFile(join(dir, source.file));
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (sha256 !== source.sha256)
    throw new Error(`${source.file}: SHA-256 mismatch (${sha256})`);
  const pdf = await getDocument({ data: new Uint8Array(data) }).promise;
  let seq = 0;
  for (const pageNo of TABLE_PAGES) {
    const rows = await readTable(await pdf.getPage(pageNo));
    for (const r of rows) {
      if (!r.name && !r.credits) continue;
      if (flag === "--check")
        console.log(
          [
            source.department,
            pageNo,
            groupId(r.group, r.section) || "?",
            r.name,
            r.kind,
            r.credits,
            r.year,
            r.term,
            r.group,
            r.section,
          ].join("\t"),
        );
      if (!r.name || !r.credits || !r.form) {
        problems.push(
          `${source.file} p${pageNo}: incomplete row ${JSON.stringify(r)}`,
        );
        continue;
      }
      const group = groupId(r.group, r.section);
      if (!group)
        problems.push(`${source.file} p${pageNo}: no group for ${r.name}`);
      const cs =
        source.department === "cs" ? csByName.get(norm(r.name)) : undefined;
      if (source.department === "cs" && !cs)
        problems.push(`${source.file}: ${r.name} is not in the curriculum`);
      courses.push({
        id:
          cs?.id ??
          `kgu-${source.department}-${String(++seq).padStart(3, "0")}`,
        name: r.name,
        aliases: csByName.get(norm(r.name))?.aliases ?? [],
        credits: r.credits,
        department: source.department,
        group,
        kind: r.kind,
        year: r.year,
        term: r.term,
        page: pageNo,
      });
    }
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
}
if (flag !== "--check" && !problems.length) {
  const out = {
    version: "1.0.0",
    note: "情報学部4学科の2024年度入学生用カリキュラム表（学則別表第１）から scripts/build-course-master.mjs で生成。手で編集しない。",
    departments: Object.fromEntries(
      SOURCES.map((s) => [
        s.department,
        {
          label: s.label,
          source: {
            url: BASE + s.file,
            pages: TABLE_PAGES,
            checkedAt: CHECKED_AT,
            status: "verified",
            sha256: s.sha256,
          },
        },
      ]),
    ),
    courses,
  };
  await writeFile(
    new URL("../src/data/course-master.json", import.meta.url),
    JSON.stringify(out, null, 2) + "\n",
  );
  console.log(`wrote ${courses.length} courses`);
}
