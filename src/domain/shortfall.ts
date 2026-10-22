import { matches } from "./engine";
import {
  units,
  type Curriculum,
  type Expression,
  type Placement,
} from "./schema";

interface ResultLike {
  status: string;
  expression: Expression;
  missing?: number;
  missingCourses?: string[];
}
interface Node {
  keys: Set<string>;
  need: number;
  children: Node[];
  courses: number;
}
// Every (section, kind) a counted course can sit in; the 学部枠 is synthetic.
function universe(c: Curriculum): Placement[] {
  const seen = new Map<string, Placement>();
  for (const p of c.placements)
    if (p.eligible) seen.set(`${p.section}|${p.kind}`, p);
  seen.set("external|elective", {
    courseId: "external",
    credits: "0",
    section: "external",
    kind: "elective",
    eligible: true,
    external: true,
  });
  return [...seen.values()];
}
const key = (p: Placement) => `${p.section}|${p.kind}`;
const within = (a: Set<string>, b: Set<string>) =>
  [...a].every((k) => b.has(k));
const disjoint = (a: Set<string>, b: Set<string>) =>
  ![...a].some((k) => b.has(k));

// Fewest further credits (×100) that could satisfy every credit rule of one
// assessment. Shortfalls of nested conditions overlap (卒論の8単位は合計にも入る),
// so a condition needs the larger of its own shortfall and the sum of the
// disjoint conditions inside it. Missing required courses count with their
// credits inside the narrowest condition that holds them.
export function combinedShortfall(c: Curriculum, results: ResultLike[]) {
  const all = universe(c);
  const nodes: Node[] = [];
  for (const r of results) {
    const e = r.expression;
    if (e.type !== "credits" || e.selector.courseIds) continue;
    const keys = new Set(all.filter((p) => matches(p, e.selector)).map(key));
    const same = nodes.find(
      (n) => n.keys.size === keys.size && within(n.keys, keys),
    );
    if (same) same.need = Math.max(same.need, r.missing ?? 0);
    else nodes.push({ keys, need: r.missing ?? 0, children: [], courses: 0 });
  }
  const everything = new Set(all.map(key));
  let root = nodes.find((n) => within(everything, n.keys));
  if (!root) {
    root = { keys: everything, need: 0, children: [], courses: 0 };
    nodes.push(root);
  }
  // The narrowest strictly larger node is each node's parent.
  const narrowest = (keys: Set<string>, self?: Node) =>
    nodes
      .filter((n) => n !== self && within(keys, n.keys))
      .sort((a, b) => a.keys.size - b.keys.size)[0];
  for (const n of nodes) if (n !== root) narrowest(n.keys, n)?.children.push(n);
  const counted = new Set<string>();
  for (const r of results)
    for (const id of r.missingCourses ?? []) {
      const p = c.placements.find((x) => x.courseId === id);
      if (!p || counted.has(id)) continue;
      counted.add(id);
      const holder = narrowest(new Set([key(p)]));
      if (holder) holder.courses += units(p.credits);
    }
  const need = (n: Node): number => {
    const parts = n.children.map(need);
    const separate = n.children.every((a, i) =>
      n.children.every((b, j) => i === j || disjoint(a.keys, b.keys)),
    );
    const inside =
      (separate ? parts.reduce((a, b) => a + b, 0) : Math.max(0, ...parts)) +
      n.courses;
    return Math.max(n.need, inside);
  };
  return need(root);
}
