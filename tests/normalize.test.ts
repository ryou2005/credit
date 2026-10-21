import { describe, expect, it } from "vitest";
import { parseTextLines, type TextRow } from "../src/pdf/normalize";
import { courseMaster, official } from "../src/data/registry";

// Build a synthetic Ku-port-like row from [x, text] cells. Mirrors read.ts:
// items sorted by x, text = joined strings. Column x positions match the real PDF.
let y = 800;
function row(page: number, cells: [number, string][]): TextRow {
  const items = cells
    .map(([x, str]) => ({ str, x, width: 10 }))
    .sort((a, b) => a.x - b.x);
  const text = items
    .map((i) => i.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { page, y: (y -= 16), text, items };
}
// Column anchors learned from this header row (name≈78, credit≈366, eval≈404, …).
const header = (page: number): TextRow =>
  row(page, [
    [169, "科目"],
    [352, "単位数"],
    [399, "評価"],
    [442, "年度"],
    [486, "学期"],
    [528, "教員氏名"],
  ]);
const course = (
  page: number,
  name: string,
  credit: string,
  evaluation: string,
  year: string,
  { enrolled = false } = {},
): TextRow => {
  const cells: [number, string][] = [[78, name]];
  if (enrolled) cells.push([60, "※"]);
  if (credit) cells.push([366, credit]);
  if (evaluation) cells.push([404, evaluation]);
  if (year) cells.push([442, year]);
  cells.push([486, "前期"], [519, "教員 太郎"]);
  return row(page, cells);
};

describe("Ku-port成績一覧表の列解析", () => {
  it("合格科目: 列を正しく分離し、評価から修得を下書き（未確認）", () => {
    const r = parseTextLines(
      [header(1), course(1, "情報学基礎論I", "2.0", "B", "2024")],
      official,
    );
    const g = r.grades.at(-1)!;
    expect(g.name).toBe("情報学基礎論I");
    expect(g.credits).toBe("2.0");
    expect(g.evaluation).toBe("B");
    expect(g.year).toBe("2024");
    expect(g.status).toBe("earned"); // A+〜D は合格（公式 gpa_2024.pdf）
    expect(g.confirmed).toBe(false); // 自動算入はしない
    expect(g.courseId).not.toBe(""); // 科目マスターに一致（Ⅰ↔I は NFKC で一致）
  });

  it("F行: 単位数欄が空でも列がずれず、不合格になり、単位数はマスターで補う", () => {
    const r = parseTextLines(
      [header(1), course(1, "文学A", "", "F", "2025")],
      official,
    );
    const g = r.grades.at(-1)!;
    expect(g.evaluation).toBe("F");
    expect(g.year).toBe("2025"); // 年度を単位数として誤読しない
    expect(g.credits).toBe("2"); // PDFは空欄 → 科目マスターの2単位
    expect(g.creditSource).toBe("master");
    expect(g.status).toBe("failed");
  });

  it("※（履修中）: 単位数があっても修得にしない", () => {
    const r = parseTextLines(
      [header(1), course(1, "哲学B", "2.0", "", "2026", { enrolled: true })],
      official,
    );
    const g = r.grades.at(-1)!;
    expect(g.name).toBe("哲学B"); // ※ は名前から除去
    expect(g.status).toBe("enrolled");
  });

  it("略称を正式名へ: Basic Eng.I → 外国語必修に一致", () => {
    const r = parseTextLines(
      [header(1), course(1, "Basic Eng.I", "1.0", "B", "2024")],
      official,
    );
    const g = r.grades.at(-1)!;
    expect(g.courseId).not.toBe("");
    const course051 = official.courses.find((x) => x.id === g.courseId);
    expect(course051?.name).toBe("Basic English I");
    expect(g.status).toBe("earned");
  });

  it("区分見出しは科目にせず、改ページをまたいで分類を継承", () => {
    const r = parseTextLines(
      [
        header(1),
        row(1, [[24, "第Ⅰ群 総合教育科目"]]),
        row(1, [[42, "外国語科目"]]),
        row(1, [[42, "必修"]]),
        // 改ページ後の最初の科目（見出しは出ない）
        header(2),
        course(2, "Basic Eng.II", "1.0", "B", "2024"),
      ],
      official,
    );
    // 見出し行は成績にならない
    expect(r.grades).toHaveLength(1);
    const g = r.grades[0];
    expect(g.status).toBe("earned");
    expect(g.provenance.raw).toContain("外国語科目"); // 分類が継承されている
    expect(g.provenance.raw).toContain("必修");
  });

  it("折り返した教員名を新しい科目にしない", () => {
    const r = parseTextLines(
      [
        header(1),
        course(1, "デジタル信号処理", "2.0", "C", "2026"),
        row(1, [[519, "ドラシリ"]]), // 教員名の折り返し断片のみ
      ],
      official,
    );
    expect(r.grades).toHaveLength(1);
    expect(r.grades[0].provenance.raw).toContain("ドラシリ");
  });

  it("GPA表・単位修得状況表のページは明細化しない", () => {
    const r = parseTextLines(
      [
        row(5, [[200, "年度学期GPA推移表"]]),
        row(5, [
          [40, "2024年度 前期(1Q)"],
          [300, "2.67"],
        ]),
        row(7, [[200, "単位修得状況表"]]),
        row(7, [
          [40, "合計"],
          [300, "99.5"],
          [400, "18.5"],
          [500, "118.0"],
        ]),
      ],
      official,
    );
    expect(r.grades).toHaveLength(0);
  });

  it("同一科目の再履修・再掲は科目IDが同じで、エンジンが重複排除する", () => {
    // 2回履修（F→再履修）＋ 別区分に再掲。読み取りは履歴を残すが courseId は同一。
    const r = parseTextLines(
      [
        header(1),
        course(1, "情報学基礎論I", "", "F", "2024"),
        course(1, "情報学基礎論I", "2.0", "B", "2025"),
      ],
      official,
    );
    const ids = r.grades.map((g) => g.courseId).filter(Boolean);
    expect(new Set(ids).size).toBe(1); // 同一 courseId に解決
  });

  it("「情報系他学科科目」の見出しの下は他学科の科目として扱い、改ページ後も引き継ぐ", () => {
    const r = parseTextLines(
      [
        header(3),
        row(3, [[24, "第Ⅲ群 専門科目"]]),
        course(3, "機械学習", "2.0", "A", "2025"), // 自学科（CS 第Ⅲ群A）
        row(3, [[24, "情報系他学科科目 専門科目 選択"]]),
        header(4),
        course(4, "デジタル信号処理", "2.0", "C", "2026"),
        course(4, "デジタル信号処理演習", "1.0", "C", "2026"),
        course(4, "機械学習", "", "F", "2025"), // 情報科学科の類似科目
        row(4, [[24, "数理・データサイエンス・AI（リテラシー）"]]),
        course(4, "情報学基礎論I", "2.0", "B", "2024"), // 再掲：自学科に戻る
      ],
      official,
    );
    const [ownMl, dsp, dspLab, otherMl, relisted] = r.grades;
    expect(ownMl.otherDepartment).toBe(false);
    expect(ownMl.courseId).not.toBe("");
    // 他学科：判定用の科目IDには結び付けず、マスターの他学科科目に対応させる
    for (const g of [dsp, dspLab, otherMl]) {
      expect(g.otherDepartment).toBe(true);
      expect(g.courseId).toBe("");
    }
    const dept = (g: typeof dsp) =>
      courseMaster.courses.find((x) => x.id === g.masterId)?.department;
    expect(dept(dspLab)).toBe("id");
    expect(dsp.masterId).not.toBe("");
    expect(dept(otherMl)).toBe("is");
    expect(otherMl.credits).toBe("2"); // 空欄のFをマスターで補完
    expect(otherMl.creditSource).toBe("master");
    expect(relisted.otherDepartment).toBe(false);
    expect(official.courses.find((x) => x.id === relisted.courseId)?.name).toBe(
      "情報学基礎論Ⅰ",
    );
  });

  it("交換形式（| 区切り）と原文・ページ保持は従来どおり", () => {
    const raw = "未知科目 | | 1.5 | ZZ | 2025 | 不明";
    const r = parseTextLines(
      [{ page: 3, y: 700, text: raw, items: [{ str: raw, x: 40, width: 10 }] }],
      official,
    );
    expect(r.grades[0].status).toBe("unknown");
    expect(r.grades[0].provenance.raw).toBe(raw);
    expect(r.grades[0].provenance.page).toBe(3);
  });
});
