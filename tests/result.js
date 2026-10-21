
/*
 * result.js
 * 学生情報・計算結果・科目一覧を画面に表示する
 */

export function displayResults({
  studentLabel,
  subjects,
  results
}) {
  // 学生情報を表示
  document.querySelector("#studentSummary").textContent =
    studentLabel;

  // 区分ごとの計算結果を表示
  const resultBody = document.querySelector("#resultBody");
  resultBody.replaceChildren();

  for (const row of results) {
    const tr = document.createElement("tr");

    const values = [
      row.category,
      row.subcategory,
      row.detail,
      row.acquired,
      row.required,
      row.remaining
    ];

    for (const value of values) {
      const td = document.createElement("td");
      td.textContent = value ?? "";
      tr.appendChild(td);
    }

    resultBody.appendChild(tr);
  }

  // PDFから読み取った科目一覧を表示
  const subjectsBody = document.querySelector("#subjectsBody");
  subjectsBody.replaceChildren();

  for (const subject of subjects) {
    const tr = document.createElement("tr");

    const values = [
      subject.name,
      subject.credits,
      subject.category,
      subject.subcategory,
      subject.detail,
      subject.status
    ];

    for (const value of values) {
      const td = document.createElement("td");
      td.textContent = value ?? "";
      tr.appendChild(td);
    }

    subjectsBody.appendChild(tr);
  }

  // 結果画面を表示
  document.querySelector("#resultSection").hidden = false;
}
