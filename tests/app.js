
/*
 * app.js
 * 各ファイルを連携させ、単位数計算の流れを制御する
 */

import { setupStudentInfo } from "./studentInfo.js";

import {
  getRequirements,
  getStudentLabel
} from "./requirements.js";

import { readSubjectsFromPdf } from "./pdfReader.js";

import { calculateCredits } from "./creditCalculator.js";

import { displayResults } from "./result.js";

// 学生情報の入力機能を初期化
const studentInfo = setupStudentInfo();

// HTMLの要素を取得
const fileInput = document.querySelector("#pdfFile");
const calculateButton = document.querySelector("#calculateButton");
const status = document.querySelector("#status");
const resultSection = document.querySelector("#resultSection");

// 計算ボタンが押されたときの処理
calculateButton.addEventListener("click", async () => {
  // 前回の結果とメッセージをリセット
  status.textContent = "";
  resultSection.hidden = true;
  calculateButton.disabled = true;

  try {
    // 入学年度・学部・学科を取得
    const student = studentInfo.getValue();

    // 選択されたPDFファイルを取得
    const file = fileInput.files[0];

    if (!file) {
      throw new Error("成績PDFを選択してください。");
    }

    if (file.type !== "application/pdf") {
      throw new Error("PDFファイルを選択してください。");
    }

    status.textContent =
      "PDFを読み取り、単位数を計算しています...";

    // 学生情報に対応する必要単位数を取得
    const requirements = getRequirements(student);

    // PDFから科目情報を読み取る
    const subjects = await readSubjectsFromPdf(file);

    // 区分ごとの取得単位数・残り単位数を計算
    const results = calculateCredits(subjects, requirements);

    // 学生情報・科目一覧・計算結果を画面に表示
    displayResults({
      studentLabel: getStudentLabel(student),
      subjects,
      results
    });

    status.textContent =
      `${subjects.length}科目を読み取りました。`;

  } catch (error) {
    // エラーが発生した場合はメッセージを表示
    status.textContent =
      error instanceof Error
        ? error.message
        : "処理中にエラーが発生しました。";

  } finally {
    // ボタンを再び操作できるようにする
    calculateButton.disabled = false;
  }
});
