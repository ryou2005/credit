import curriculum from "./src/data/kogakuin-2024.json" with { type: "json" };

// 要件データを追加したときは、この対応表にも表示名を登録する。
const supportedStudents =
  curriculum.releaseStatus === "verified"
    ? [
        {
          entryYear: curriculum.entryYear,
          faculty: curriculum.faculty,
          facultyLabel: "情報学部",
          department: curriculum.department,
          departmentLabel: "コンピュータ科学科",
        },
      ]
    : [];

export function getSupportedStudents() {
  return supportedStudents.map((student) => ({ ...student }));
}

const clean = (value) =>
  typeof value === "string" ? value.normalize("NFKC").trim() : "";

/** 未入力・形式・所属の組み合わせを確認し、共通のID形式にそろえる。 */
export function validateStudentInfo(input) {
  if (!input || typeof input !== "object") {
    throw new Error("学生情報を入力してください。");
  }
  const year =
    typeof input.entryYear === "number"
      ? String(input.entryYear)
      : clean(input.entryYear);
  const faculty = clean(input.faculty);
  const department = clean(input.department);
  if (!year) throw new Error("入学年度を選択してください。");
  if (!/^\d{4}$/.test(year)) {
    throw new Error("入学年度は西暦4桁で入力してください。");
  }
  if (!faculty) throw new Error("学部を選択してください。");
  if (!department) throw new Error("学科を選択してください。");
  const student = supportedStudents.find(
    (candidate) =>
      candidate.entryYear === Number(year) &&
      [candidate.faculty, candidate.facultyLabel].includes(faculty) &&
      [candidate.department, candidate.departmentLabel].includes(department),
  );
  if (!student) {
    throw new Error(
      "この入学年度・学部・学科の組み合わせには対応していません。",
    );
  }
  return {
    entryYear: student.entryYear,
    faculty: student.faculty,
    department: student.department,
  };
}

/** 既存のselect要素に選択肢を設定する。親を変更すると子の選択を解除する。 */
export function setupStudentInfo({
  root = globalThis.document,
  selectors = {},
} = {}) {
  if (!root?.querySelector)
    throw new Error("学生情報の入力画面が見つかりません。");
  const fields = Object.fromEntries(
    ["entryYear", "faculty", "department"].map((key) => {
      const selector = selectors[key] ?? `#${key}`;
      const field = root.querySelector(selector);
      if (field?.tagName !== "SELECT") {
        throw new Error(`学生情報の選択欄 ${selector} が見つかりません。`);
      }
      return [key, field];
    }),
  );
  const fill = (field, rows, placeholder) => {
    const doc = field.ownerDocument;
    const option = (value, label) => {
      const node = doc.createElement("option");
      node.value = String(value);
      node.textContent = label;
      return node;
    };
    const unique = [
      ...new Map(rows.map(([value, label]) => [String(value), label])),
    ];
    field.replaceChildren(
      option("", placeholder),
      ...unique.map(([v, l]) => option(v, l)),
    );
    field.required = true;
    field.disabled = unique.length === 0;
    field.value = "";
  };
  const updateDepartments = () => {
    const rows = supportedStudents.filter(
      (s) =>
        String(s.entryYear) === fields.entryYear.value &&
        s.faculty === fields.faculty.value,
    );
    fill(
      fields.department,
      rows.map((s) => [s.department, s.departmentLabel]),
      "学科を選択",
    );
  };
  const updateFaculties = () => {
    const rows = supportedStudents.filter(
      (s) => String(s.entryYear) === fields.entryYear.value,
    );
    fill(
      fields.faculty,
      rows.map((s) => [s.faculty, s.facultyLabel]),
      "学部を選択",
    );
    updateDepartments();
  };
  fill(
    fields.entryYear,
    supportedStudents.map((s) => [s.entryYear, `${s.entryYear}年度`]),
    "入学年度を選択",
  );
  updateFaculties();
  fields.entryYear.addEventListener("change", updateFaculties);
  fields.faculty.addEventListener("change", updateDepartments);
  return {
    getValue() {
      return validateStudentInfo(
        Object.fromEntries(
          Object.entries(fields).map(([key, field]) => [key, field.value]),
        ),
      );
    },
    destroy() {
      fields.entryYear.removeEventListener("change", updateFaculties);
      fields.faculty.removeEventListener("change", updateDepartments);
    },
  };
}
