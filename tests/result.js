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
  //HTMLのid="studentSummary"の要素を取得し、textContentに学生情報のラベルを設定
  document.querySelector("#studentSummary").textContent =
    studentLabel;

  // 区分ごとの計算結果を表示
  //HTMLのid="resultBody"の要素を取得し、replaceChildren()で前回の結果をリセット
  const resultBody = document.querySelector("#resultBody");
  resultBody.replaceChildren(); // 前回の結果をリセット

  for (const row of results) { //resultsの各要素を1件ずつrowに取り出す
    const tr = document.createElement("tr"); //表の行要素<tr>を作成

    const values = [
      row.category, //区分
      row.subcategory, //下位区分
      row.detail, //詳細
      row.acquired, //取得単位数
      row.required, //必要単位数
      row.remaining //残り単位数
    ];

    for (const value of values) { //valuesの各要素を1件ずつvalueに取り出す
      const td = document.createElement("td"); //表のセル要素<td>を作成
      td.textContent = value ?? ""; //valueがnullまたはundefinedの場合は空文字を設定
      tr.appendChild(td);  //作成したセル<td>を行<tr>に追加
    }

    resultBody.appendChild(tr); //作成した行<tr>を表の本体に追加
  }

  // PDFから読み取った科目一覧を表示
  const subjectsBody = document.querySelector("#subjectsBody"); //HTMLからid="subjectsBody"の要素を取得
  subjectsBody.replaceChildren(); //前回の結果をリセット

  for (const subject of subjects) {
    const tr = document.createElement("tr"); //表の行要素<tr>を作成

    const values = [
      subject.name, //科目名
      subject.credits, //単位数
      subject.category, //区分
      subject.subcategory, //下位区分
      subject.detail, //詳細
      subject.status //状態
    ];

    for (const value of values) { //valuesの各要素を1件ずつvalueに取り出す
      const td = document.createElement("td"); //表のセル要素<td>を作成
      td.textContent = value ?? ""; //valueがnullまたはundefinedの場合は空文字を設定
      tr.appendChild(td);  //作成したセル<td>を行<tr>に追加
    }

    subjectsBody.appendChild(tr); //作成した行<tr>を表の本体に追加
  }

  // 結果画面を表示
  /*HTMLからid="resultSection"の要素を取得し、hiddenプロパティをfalseに設定して表示
  これにより隠れていた結果画面が表示される
  */
  document.querySelector("#resultSection").hidden = false; 
}
