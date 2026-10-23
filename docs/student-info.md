# 学生情報・単位要件の連携

担当ファイルはルートの `studentInfo.js` と `requirement.js`。
現在のReactアプリは `src/data/registry.ts` でログイン情報から所属を取得するため、この入力フォームはまだ呼び出していない。
`tests/app.js` は別途HTMLとPDF読取・単位計算モジュールを必要とする連携例であり、実行できるテストではない。

## 入力画面

次のselectを用意し、DOMの生成後に初期化する。選択肢は初期化時に設定される。

```html
<label
  >入学年度
  <select id="entryYear"></select
></label>
<label
  >学部
  <select id="faculty"></select
></label>
<label
  >学科
  <select id="department"></select
></label>
```

```js
import { setupStudentInfo } from "./studentInfo.js";
import { getRequirements, getStudentLabel } from "./requirement.js";

const input = setupStudentInfo();
// 計算ボタンの処理内で呼ぶ。未入力・未対応の場合はErrorになる。
const student = input.getValue();
// { entryYear: 2024, faculty: "information", department: "cs" }
const requirements = getRequirements(student);
const label = getStudentLabel(student);
```

別の要素IDを使用する場合は、`setupStudentInfo({ root: document, selectors: { entryYear: "#year", faculty: "#faculty", department: "#department" } })` と指定する。
画面を破棄するときは `input.destroy()` でイベントを解除する。
入力値の確認だけなら `validateStudentInfo(student)` を使用する。全角・前後空白を正規化し、日本語の学部・学科名も受け付ける。

## 要件データの形式

`getRequirements(student, assessment)` の第2引数は以下のとおり。

| 値                     | 用途         | 現在の対応         |
| ---------------------- | ------------ | ------------------ |
| `graduation`（省略時） | 卒業         | 登録済み           |
| `thesis-entry`         | 卒業論文着手 | 登録済み           |
| `progression`          | 進級         | 未登録のためエラー |

戻り値は `src/data/kogakuin-2024.json` の独立したコピーに、`assessment` と `selectedRules` を追加したオブジェクト。

- `selectedRules`：指定した判定種別の条件。`expression` に単位数・対象区分・必修科目などがある。
- `rules`：既存エンジンとの互換性のため、全判定種別の条件を保持する。
- `courses` / `placements`：科目と単位数・区分・必修種別。
- `caps`：他学科科目などの算入上限。
- `source` / 各ルールの `source`：根拠資料の情報。

計算担当は `selectedRules` を評価し、`caps` を適用する。条件別の最低単位数は重複するため、単純加算しない。
既存の `evaluateCurriculum` に渡す場合は通常どおり、卒業は `results`、卒論着手は `thesisEntry.results` を参照する。
連携例の `calculateCredits` は未提供のため、このデータ形式に合わせた実装が必要。

現在の対象は2024年度入学・情報学部・コンピュータ科学科。進級条件を卒論着手条件で代用しない。
新しい対象を追加するときは、要件データの追加・根拠確認とあわせて、`studentInfo.js` の対応表および `requirement.js` のデータ選択処理を拡張する。
