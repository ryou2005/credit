import { describe, expect, it } from "vitest";
import {
  getSupportedStudents,
  setupStudentInfo,
  validateStudentInfo,
} from "../studentInfo.js";
import { getRequirements, getStudentLabel } from "../requirement.js";
import { evaluateCurriculum } from "../src/domain/engine";
import { validateCurriculum } from "../src/domain/validate";

const student = { entryYear: 2024, faculty: "information", department: "cs" };

describe("学生情報と単位要件の契約", () => {
  it("全角年度・前後空白・日本語の所属名を共通のIDにそろえる", () => {
    expect(
      validateStudentInfo({
        entryYear: " ２０２４ ",
        faculty: " 情報学部 ",
        department: "コンピュータ科学科",
      }),
    ).toEqual(student);
    expect(getStudentLabel(student)).toBe(
      "2024年度入学・情報学部・コンピュータ科学科",
    );
  });

  it.each([
    [null, "学生情報"],
    [{ ...student, entryYear: "" }, "入学年度"],
    [{ ...student, entryYear: "2024abc" }, "西暦4桁"],
    [{ ...student, entryYear: 2024.5 }, "西暦4桁"],
    [{ ...student, faculty: "" }, "学部"],
    [{ ...student, department: "" }, "学科"],
    [{ ...student, entryYear: 2025 }, "対応していません"],
    [{ ...student, faculty: "工学部" }, "対応していません"],
    [{ ...student, department: "情報デザイン学科" }, "対応していません"],
  ])("不正・未対応の入力を拒否する: %j", (input, message) => {
    expect(() => validateStudentInfo(input)).toThrow(message);
    expect(() => getRequirements(input)).toThrow(message);
  });

  it("卒業124単位と卒論着手105単位を区別し、未登録の進級条件は拒否する", () => {
    const graduation = getRequirements(student);
    const thesis = getRequirements(student, "thesis-entry");
    expect(
      graduation.selectedRules.every((r) => r.assessment === "graduation"),
    ).toBe(true);
    expect(
      graduation.selectedRules.find((r) => r.id === graduation.totalRuleId)
        .expression.minimum,
    ).toBe("124");
    expect(
      thesis.selectedRules.every((r) => r.assessment === "thesis-entry"),
    ).toBe(true);
    expect(
      thesis.selectedRules.some((r) => r.expression.minimum === "105"),
    ).toBe(true);
    expect(() => getRequirements(student, "progression")).toThrow(
      "進級要件は未登録",
    );
    expect(() => getRequirements(student, "other")).toThrow("判定種別");
  });

  it("必修科目と上限を保持し、既存エンジンで未修得を未達成と判定できる", () => {
    const requirements = getRequirements(student);
    const result = evaluateCurriculum(validateCurriculum(requirements), []);
    expect(result.status).toBe("unmet");
    expect(result.thesisEntry.status).toBe("unmet");
    expect(
      requirements.selectedRules.some(
        (r) => r.expression.type === "allCourses",
      ),
    ).toBe(true);
    expect(requirements.caps.some((cap) => cap.maximum === "6")).toBe(true);
  });

  it("取得結果を変更しても、次回の取得に影響しない", () => {
    const requirements = getRequirements(student);
    requirements.rules[0].expression.minimum = "0";
    requirements.caps.length = 0;
    getSupportedStudents()[0].facultyLabel = "変更";
    expect(getRequirements(student).rules[0].expression.minimum).toBe("124");
    expect(getRequirements(student).caps.length).toBeGreaterThan(0);
    expect(getStudentLabel(student)).toContain("情報学部");
  });
});

// 選択肢生成とイベント連携だけを再現する最小のDOM。
function inputRoot() {
  const fields = Object.fromEntries(
    ["entryYear", "faculty", "department"].map((key) => {
      const field = new EventTarget();
      Object.assign(field, {
        tagName: "SELECT",
        value: "",
        children: [],
        ownerDocument: { createElement: () => ({}) },
        replaceChildren(...nodes) {
          this.children = nodes;
        },
      });
      return [key, field];
    }),
  );
  return { fields, querySelector: (selector) => fields[selector.slice(1)] };
}

it("年度→学部→学科の選択と、親変更時のリセット・イベント解除", () => {
  const root = inputRoot();
  const controller = setupStudentInfo({ root });
  const { entryYear, faculty, department } = root.fields;
  expect(faculty.disabled).toBe(true);
  expect(department.disabled).toBe(true);
  expect(() => controller.getValue()).toThrow("入学年度");
  entryYear.value = "2024";
  entryYear.dispatchEvent(new Event("change"));
  expect(faculty.children[1].value).toBe("information");
  faculty.value = "information";
  faculty.dispatchEvent(new Event("change"));
  expect(department.children[1].value).toBe("cs");
  department.value = "cs";
  expect(controller.getValue()).toEqual(student);
  entryYear.value = "";
  entryYear.dispatchEvent(new Event("change"));
  expect(faculty.value).toBe("");
  expect(department.value).toBe("");
  expect(department.disabled).toBe(true);
  controller.destroy();
  entryYear.value = "2024";
  entryYear.dispatchEvent(new Event("change"));
  expect(faculty.disabled).toBe(true);
});

it("入力欄がない画面では設定エラーを返す", () => {
  expect(() => setupStudentInfo({ root: null })).toThrow("入力画面");
  expect(() =>
    setupStudentInfo({ root: { querySelector: () => null } }),
  ).toThrow("#entryYear");
});
