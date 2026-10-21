import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  parseTextLines,
  validatePdfFile,
  type TextItem,
  type TextRow,
} from "./normalize";
import type { Curriculum } from "../domain/schema";
GlobalWorkerOptions.workerSrc = worker;
export async function readPdf(file: File, c: Curriculum) {
  validatePdfFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new Error(
      "PDF形式を確認できません。PDFを再出力するか手入力してください。",
    );
  const task = getDocument({
    data: bytes,
    cMapUrl: new URL(`${import.meta.env.BASE_URL}pdfjs/cmaps/`, location.href)
      .href,
    cMapPacked: true,
    standardFontDataUrl: new URL(
      `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
      location.href,
    ).href,
    wasmUrl: new URL(`${import.meta.env.BASE_URL}pdfjs/wasm/`, location.href)
      .href,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: true,
    verbosity: 0,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100)
      throw new Error(
        "100ページを超えています。成績ページだけを再保存してください。",
      );
    const rows: TextRow[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      const byY = new Map<number, TextItem[]>();
      for (const item of content.items) {
        if (!("str" in item)) continue;
        // Group into visual rows by rounded baseline; keep x for column slicing.
        const y = Math.round(item.transform[5] / 3) * 3;
        const row = byY.get(y) ?? [];
        row.push({
          str: item.str,
          x: item.transform[4],
          width: item.width ?? 0,
        });
        byY.set(y, row);
      }
      for (const [y, items] of [...byY].sort((a, b) => b[0] - a[0])) {
        items.sort((a, b) => a.x - b.x);
        const text = items
          .map((i) => i.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) rows.push({ page: p, y, text, items });
      }
    }
    if (!rows.length)
      throw new Error(
        "文字を取り出せませんでした。画像のみのPDFは未対応です。Ku-portから文字を含むPDFを再保存するか手入力してください。",
      );
    if (rows.length > 3000)
      throw new Error(
        "文字行が多すぎます。成績ページだけを再保存してください。",
      );
    return parseTextLines(rows, c);
  } catch (e) {
    if (e instanceof Error && e.name === "PasswordException")
      throw new Error(
        "暗号化・パスワード付きPDFは未対応です。保護のないPDFを再出力するか手入力してください。",
      );
    if (e instanceof Error && e.name === "InvalidPDFException")
      throw new Error(
        "PDFが破損している可能性があります。再保存または手入力してください。",
      );
    if (e instanceof Error && /PDF|ページ|文字行/.test(e.message)) throw e;
    throw new Error(
      "PDFを読み取れませんでした。別のPDFで再試行するか手入力してください。",
    );
  } finally {
    await task.destroy();
  }
}
