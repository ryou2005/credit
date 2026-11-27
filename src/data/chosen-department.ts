// The department a JX student picked, kept in this browser only (no server)
// so the department dialog is not shown again on the next sign-in.
// Keyed by student number; the value is a curriculum id.
const key = (student: string) => `credit-check:department:${student}`;

export function loadChosenDepartment(
  student: string,
  allowed: string[],
  storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage,
) {
  try {
    const id = storage?.getItem(key(student)) ?? "";
    // A stored id that is no longer offered (rules withdrawn) is ignored.
    return allowed.includes(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function saveChosenDepartment(
  student: string,
  curriculumId: string,
  storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage,
) {
  try {
    storage?.setItem(key(student), curriculumId);
  } catch {
    // Private mode or storage full: the dialog simply shows again next time.
  }
}
