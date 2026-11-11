// Build the graduation-rule data of 情報通信工学科・情報デザイン学科・情報科学科
// (2024年度入学) from src/data/course-master.json and the 進級・卒業条件表 (p4)
// of each department's official PDF, transcribed into DEPARTMENTS below.
//
//   node scripts/build-curricula.mjs            write src/data/kogakuin-2024-<dept>.json
//   node scripts/build-curricula.mjs --check    also rebuild CS from the same recipe
//                                               and compare with kogakuin-2024.json
//
// Courses, credits and 必修/選択必修/選択 come from the course master (p2・p3).
// 第Ⅰ群 a)〜d) are the same table in all four PDFs, so they are taken from the
// verified CS data after checking the rows are identical. 第Ⅲ群 区分 boundaries
// were read from page images (the first course of each 区分 is listed below).
import { readFile, writeFile } from "node:fs/promises";

const BASE =
  "https://www.kogakuin.ac.jp/student/syllabus_binran/u53qdr00000037u3-att/";
const CHECKED_AT = "2026-11-11";
const root = new URL("../src/data/", import.meta.url);
const master = JSON.parse(await readFile(new URL("course-master.json", root)));
const cs = JSON.parse(await readFile(new URL("kogakuin-2024.json", root)));
const key = (s) => s.normalize("NFKC").replace(/\s+/g, "");

const DEPARTMENTS = {
  ic: {
    file: "2025info1.pdf",
    out: "kogakuin-2024-ic.json",
    // 第Ⅲ群の区分：最初の科目名と表示名（p3の表、画像で確認）
    areas: [
      {
        section: "III-A",
        first: "ネットワークセキュリティ",
        label: "通信・ネットワーク",
      },
      { section: "III-B", first: "通信情報理論", label: "情報メディア" },
    ],
    commonFirst: "情報通信工学実験Ⅰ",
    mandatorySpecial: "31",
    entryMandatorySpecial: "29",
    // p4 注2
    named: [
      "情報学実験",
      "情報通信工学実験Ⅰ",
      "情報通信セミナーⅠ(PBL)",
      "情報通信セミナーⅡ(PBL)",
    ],
    // p4 注3：選択必修12単位のうち、第Ⅱ群b・第Ⅲ群をまたぐ3区分から各2単位以上
    selectiveAreas: [
      {
        id: "smart",
        label: "スマートデバイス",
        courses: [
          "電気回路理論Ⅱ",
          "電気回路理論演習Ⅱ",
          "アナログ電子回路Ⅰ",
          "電磁気学",
          "電磁気学演習",
          "電子デバイス工学",
        ],
      },
      {
        id: "net",
        label: "通信・ネットワーク",
        courses: [
          "通信システム基礎",
          "通信工学",
          "無線通信工学",
          "情報通信ネットワーク",
          "ネットワークセキュリティ",
          "移動通信工学",
        ],
      },
      {
        id: "media",
        label: "情報メディア",
        courses: [
          "デジタルメディア工学基礎",
          "システムソフトウェア",
          "通信情報理論",
          "通信ソフトウェア論Ⅰ",
          "画像工学",
          "マルチメディア工学",
        ],
      },
    ],
    // p4 注1
    excluded: [
      ["数値計算法概論", "コンピュータ科学科"],
      ["数値計算論", "情報デザイン学科"],
      ["情報コンテンツと知的財産", "情報デザイン学科"],
      ["情報と法", "情報科学科"],
      ["計算幾何学", "コンピュータ科学科"],
      ["デザイン幾何学", "情報デザイン学科"],
      ["システム幾何学", "情報科学科"],
      ["情報ネットワーク論", "コンピュータ科学科"],
      ["情報ネットワーク基礎論", "情報デザイン学科"],
      ["情報ネットワーク応用論", "情報デザイン学科"],
      ["情報ネットワーク概論", "情報科学科"],
    ],
    externalInEntry: true,
    notes: [
      "p4注3（スマートデバイス・通信・ネットワーク・情報メディアの各2単位以上）の注記は卒論着手の列にあるが、コンピュータ科学科と同じく卒業の判定にも適用しています。",
    ],
  },
  id: {
    file: "2025info3.pdf",
    out: "kogakuin-2024-id.json",
    areas: [
      { section: "III-A", first: "CG数学", label: "コンテンツ設計" },
      { section: "III-B", first: "感覚･知覚心理学", label: "人間情報" },
      { section: "III-C", first: "音情報処理", label: "知識情報" },
    ],
    commonFirst: "情報デザインセミナーⅠ(PBL)",
    mandatorySpecial: "27",
    entryMandatorySpecial: "25",
    named: [
      "情報学実験",
      "情報デザイン学実験",
      "情報デザインセミナーⅠ(PBL)",
      "情報デザインセミナーⅡ(PBL)",
    ],
    // 情報デザイン学科のp4には区分ごとの選択必修条件（注3）がない
    selectiveAreas: [],
    excluded: [
      ["統計解析学", "コンピュータ科学科"],
      ["多変量解析", "情報科学科"],
      ["数値計算法", "情報通信工学科"],
      ["数値計算法概論", "コンピュータ科学科"],
      ["通信システム基礎", "情報通信工学科"],
      ["情報ネットワーク論", "コンピュータ科学科"],
      ["情報ネットワーク概論", "情報科学科"],
      ["オブジェクト指向プログラミング", "コンピュータ科学科"],
      // p4注1では「(PBL)」が省略されている。CSの表では「…演習(PBL)」の1科目だけ
      ["オブジェクト指向プログラミング演習(PBL)", "コンピュータ科学科"],
      ["知的財産", "コンピュータ科学科"],
      ["知的財産", "情報通信工学科"],
      ["情報と法", "情報科学科"],
    ],
    externalInEntry: true,
    notes: [
      // p4【注1に関わる、互いに類似するため一方しか算入できない科目群】
      "p4注1の「一方しか算入できない科目群」（情報処理技術概論（コンピュータ科学科）・情報処理技術基礎論（情報科学科））：情報処理技術概論は2024年度入学のコンピュータ科学科のカリキュラム表にないため、成績PDFに出た場合は科目を特定できず要確認になります。両方が自動で算入されることはありません。",
    ],
  },
  is: {
    file: "2025info4re1.pdf",
    out: "kogakuin-2024-is.json",
    areas: [
      { section: "III-A", first: "マーケティング概論", label: "経営情報" },
      { section: "III-B", first: "Webプログラミング", label: "情報インフラ" },
      {
        section: "III-C",
        first: "オペレーションズリサーチ",
        label: "データ科学",
      },
    ],
    commonFirst: "情報科学セミナーⅠ(PBL)",
    mandatorySpecial: "29",
    entryMandatorySpecial: "27",
    named: [
      "情報学実験",
      "情報科学実験",
      "情報科学セミナーⅠ(PBL)",
      "情報科学セミナーⅡ(PBL)",
    ],
    // p4 注3：経営情報・情報インフラ・データ科学の選択必修を各2単位以上（第Ⅲ群の区分と一致）
    sectionSelective: true,
    selectiveAreas: [],
    excluded: [
      ["統計解析学", "コンピュータ科学科"],
      ["応用確率・統計学", "情報デザイン学科"],
      ["応用確率・統計学演習", "情報デザイン学科"],
      ["通信システム基礎", "情報通信工学科"],
      ["情報ネットワーク論", "コンピュータ科学科"],
      ["情報ネットワーク基礎論", "情報デザイン学科"],
      ["機械学習", "コンピュータ科学科"],
      ["知的財産", "情報通信工学科"],
      ["知的財産", "コンピュータ科学科"],
      ["情報コンテンツと知的財産", "情報デザイン学科"],
    ],
    // p4 注4：他学科の科目は卒業論文着手に必要な65単位には含まれない
    externalInEntry: false,
    notes: [
      "p4注5：いずれの群にも属さない他学科（情報学部以外を含む）の科目も合計124単位に算入できるとありますが、成績PDFでの表示を確認できていないため、自動では算入せず要確認として扱います。",
      "p4注1の3年次科目履修条件（情報インフラ2単位以上を含む選択必修6単位）は判定していません。",
    ],
  },
};

// The CS recipe, used only by --check to confirm this builder reproduces the
// verified CS data.
const CS_SPEC = {
  file: "2025info2.pdf",
  areas: [
    { section: "III-A", first: "音響工学基礎", label: "A" },
    { section: "III-B", first: "インターフェース論", label: "B" },
    { section: "III-C", first: "セキュリティ概論", label: "C" },
  ],
  commonFirst: "コンピュータ科学セミナーⅠ(PBL)",
  mandatorySpecial: "29",
  entryMandatorySpecial: "27",
  named: [
    "情報学実験",
    "コンピュータ科学実験",
    "コンピュータ科学セミナーⅠ(PBL)",
    "コンピュータ科学セミナーⅡ(PBL)",
  ],
  sectionSelective: true,
  selectiveAreas: [],
  excluded: cs.excludedExternal.map((e) => [e.name, e.department]),
  externalInEntry: true,
  notes: [],
};

const KIND = { 必修: "required", 選択必修: "selective", 選択: "elective" };
// 履修期 is left out: the master's text extraction of that merged cell varies
// ("前期または後期" lands on a neighbouring row) and it plays no part in the rules.
const sameRow = (a, b) =>
  key(a.name) === key(b.name) &&
  a.credits === b.credits &&
  a.kind === b.kind &&
  a.year === b.year;

function build(dept, spec) {
  const deptLabel = master.departments[dept].label;
  const src = master.departments[dept].source;
  const sha256 = src.sha256;
  const url = BASE + spec.file;
  if (src.url !== url)
    throw new Error(`${dept}: 資料URLが科目マスターと違います`);
  const source = (pages) => ({
    url,
    pages,
    checkedAt: CHECKED_AT,
    status: "verified",
    sha256,
  });
  const id = `kogakuin-2024-information-${dept}-v1`;
  const rows = master.courses.filter((x) => x.department === dept);
  const csRows = master.courses.filter((x) => x.department === "cs");
  const csSection = Object.fromEntries(
    cs.placements.map((p) => [p.courseId, p.section]),
  );
  const byName = (name) => {
    const hit = rows.filter((x) => key(x.name) === key(name));
    if (hit.length !== 1)
      throw new Error(
        `${deptLabel}: 「${name}」が科目マスターで${hit.length}件`,
      );
    return hit[0];
  };

  // 第Ⅰ群・第Ⅱ群a are the common tables: identical rows in the same order.
  for (const g of ["I", "II-a"]) {
    const mine = rows.filter((x) => x.group === g);
    const theirs = csRows.filter((x) => x.group === g);
    if (
      mine.length !== theirs.length ||
      mine.some((x, i) => !sameRow(x, theirs[i]))
    )
      throw new Error(
        `${deptLabel}: 第${g}群がコンピュータ科学科の表と一致しません`,
      );
  }
  const iSection = new Map(
    csRows
      .filter((x) => x.group === "I")
      .map((x) => [key(x.name), csSection[x.id]]),
  );

  // 第Ⅲ群: split by the first course of each 区分, in table order.
  const third = rows.filter((x) => x.group === "III");
  const starts = [
    ...spec.areas.map((a) => ({
      section: a.section,
      at: third.indexOf(byName(a.first)),
    })),
    { section: "III-common", at: third.indexOf(byName(spec.commonFirst)) },
  ];
  if (
    starts[0].at !== 0 ||
    starts.some((s, i) => i && s.at <= starts[i - 1].at)
  )
    throw new Error(`${deptLabel}: 第Ⅲ群の区分の順序が表と合いません`);
  const thirdSection = (x) => {
    if (key(x.name) === key("卒業論文(PBL)")) return "thesis";
    const i = third.indexOf(x);
    return starts.filter((s) => s.at <= i).at(-1).section;
  };

  const areaOf = new Map();
  for (const a of spec.selectiveAreas)
    for (const name of a.courses) {
      const x = byName(name);
      if (x.kind !== "選択必修" || !["II-b", "III"].includes(x.group))
        throw new Error(
          `${deptLabel}: 注3の「${name}」が第Ⅱ群b・第Ⅲ群の選択必修ではありません`,
        );
      areaOf.set(x.id, a.id);
    }

  const courses = rows.map((x) => ({
    id: x.id,
    officialCode: null,
    name: x.name,
    aliases: x.aliases,
    university: "kogakuin",
    faculty: "information",
    department: dept,
    source: source([x.page]),
  }));
  const placements = rows.map((x) => {
    const section =
      x.group === "I"
        ? iSection.get(key(x.name))
        : x.group === "II-a" || x.group === "II-b"
          ? x.group
          : x.group === "III"
            ? thirdSection(x)
            : "excluded";
    if (!section)
      throw new Error(`${deptLabel}: 「${x.name}」の区分を決められません`);
    const excluded = section === "excluded";
    const kind = excluded ? "excluded" : KIND[x.kind];
    if (!kind) throw new Error(`${deptLabel}: 「${x.name}」の必修区分が不明`);
    return {
      courseId: x.id,
      credits: x.credits,
      section,
      kind,
      eligible: !excluded,
      external: false,
      ...(areaOf.has(x.id) ? { area: areaOf.get(x.id) } : {}),
    };
  });
  const areaSections = spec.areas.map((a) => a.section);
  const special = ["II-b", ...areaSections, "III-common"];
  const sum = (ps) =>
    ps.reduce((a, p) => a + Math.round(Number(p.credits) * 100), 0) / 100;
  const requiredSpecial = sum(
    placements.filter(
      (p) => special.includes(p.section) && p.kind === "required",
    ),
  );
  if (String(requiredSpecial) !== spec.mandatorySpecial)
    throw new Error(
      `${deptLabel}: 専門の必修が${requiredSpecial}単位（p4は${spec.mandatorySpecial}）`,
    );
  const named = spec.named.map((n) => byName(n).id);
  const namedRequired = sum(
    placements.filter((p) => named.includes(p.courseId)),
  );
  if (requiredSpecial - namedRequired > Number(spec.entryMandatorySpecial))
    throw new Error(
      `${deptLabel}: 卒論着手の必修${spec.entryMandatorySpecial}単位と注2の科目が合いません`,
    );

  const rule = (suffix, assessment, label, expression) => ({
    id: `${id}-${suffix}`,
    curriculumId: id,
    entryYear: 2024,
    department: dept,
    assessment,
    label,
    source: source([4]),
    expression,
  });
  const credits = (minimum, selector) => ({
    type: "credits",
    minimum,
    selector,
  });
  const areaRules = (prefix, assessment) => [
    ...(spec.sectionSelective
      ? spec.areas.map((a) =>
          rule(
            `${prefix}${a.section}-selective`,
            assessment,
            `${dept === "cs" ? a.section : a.label} 選択必修`,
            credits("2", { sections: [a.section], kinds: ["selective"] }),
          ),
        )
      : []),
    ...spec.selectiveAreas.map((a) =>
      rule(
        `${prefix}area-${a.id}`,
        assessment,
        `${a.label} 選択必修`,
        credits("2", {
          sections: special,
          kinds: ["selective"],
          areas: [a.id],
        }),
      ),
    ),
  ];
  const common = (prefix, assessment, g) => [
    rule(
      `${prefix}total`,
      assessment,
      "算入対象の合計単位",
      credits(g.total, {}),
    ),
    rule(
      `${prefix}I-a`,
      assessment,
      "総合文化科目",
      credits(g.culture, { sections: ["I-a"] }),
    ),
    rule(
      `${prefix}I-b`,
      assessment,
      "外国語科目",
      credits("8", { sections: ["I-b"] }),
    ),
    rule(
      `${prefix}I-b-required`,
      assessment,
      "外国語科目の必修",
      credits("6", { sections: ["I-b"], kinds: ["required"] }),
    ),
    rule(
      `${prefix}I-c`,
      assessment,
      "保健体育科目",
      credits(
        "2",
        prefix
          ? { sections: ["I-c"], kinds: ["required"] }
          : { sections: ["I-c"] },
      ),
    ),
    rule(
      `${prefix}II-a`,
      assessment,
      "共通基礎科目",
      credits("12", { sections: ["II-a"] }),
    ),
    rule(
      `${prefix}II-a-required`,
      assessment,
      "共通基礎科目の必修",
      credits("8", { sections: ["II-a"], kinds: ["required"] }),
    ),
  ];
  const graduation = [
    ...common("", "graduation", { total: "124", culture: "14" }),
    rule(
      "thesis",
      "graduation",
      "卒業論文",
      credits("8", { sections: ["thesis"] }),
    ),
    rule(
      "special",
      "graduation",
      "専門基礎＋専門（卒論除く）",
      credits("71", { sections: [...special, "external"] }),
    ),
    rule(
      "mandatory-special",
      "graduation",
      "専門基礎＋専門の必修",
      credits(spec.mandatorySpecial, {
        sections: special,
        kinds: ["required"],
      }),
    ),
    rule(
      "selective",
      "graduation",
      "専門基礎＋専門の選択必修",
      credits("12", { sections: special, kinds: ["selective"] }),
    ),
    ...areaRules("", "graduation"),
    rule("mandatory", "graduation", "必修科目すべて", {
      type: "allCourses",
      courseIds: placements
        .filter((p) => p.kind === "required")
        .map((p) => p.courseId),
    }),
  ];
  const entry = [
    ...common("entry-", "thesis-entry", { total: "105", culture: "8" }),
    rule(
      "entry-special",
      "thesis-entry",
      "専門基礎＋専門（卒論除く）",
      credits("65", {
        sections: spec.externalInEntry ? [...special, "external"] : special,
      }),
    ),
    rule(
      "entry-mandatory-special",
      "thesis-entry",
      "専門基礎＋専門の必修",
      credits(spec.entryMandatorySpecial, {
        sections: special,
        kinds: ["required"],
      }),
    ),
    rule(
      "entry-mandatory-named",
      "thesis-entry",
      "必修に含める実験・セミナー（注2）",
      { type: "allCourses", courseIds: named },
    ),
    rule(
      "entry-selective",
      "thesis-entry",
      "専門基礎＋専門の選択必修",
      credits("12", { sections: special, kinds: ["selective"] }),
    ),
    ...areaRules("entry-", "thesis-entry"),
  ];

  const known = (name, label) =>
    master.courses.some(
      (x) =>
        key(x.name) === key(name) &&
        master.departments[x.department].label === label &&
        x.department !== dept &&
        ["II-b", "III"].includes(x.group),
    );
  const unknown = spec.excluded.filter(([name, label]) => !known(name, label));
  if (unknown.length)
    throw new Error(
      `${deptLabel}: 注1の科目が他学科の第Ⅱ群b・第Ⅲ群にありません: ${unknown.map(([n, l]) => `${n}（${l}）`).join("、")}`,
    );

  return {
    id,
    university: "kogakuin",
    faculty: "information",
    department: dept,
    entryYear: 2024,
    label: `工学院大学・2024年度入学・情報学部${deptLabel}`,
    version: "1.0.0",
    publicationYear: null,
    revisionYear: null,
    publicationYearNote:
      "URLの2025は資料の識別用。公開・改訂日の公式記載は未確認。",
    applicability: `通常の2024年度入学。編入・転学科・特例は別途確認。判定時所属が${deptLabel}であること。`,
    releaseStatus: "verified",
    source: source([2, 3, 4]),
    sectionLabels: Object.fromEntries(
      spec.areas.map((a) => [a.section, `専門 ${a.label}`]),
    ),
    courses,
    placements,
    equivalences: [],
    caps: [
      {
        id: "other-department-6",
        maximum: "6",
        selector: { external: true },
        source: source([4]),
      },
    ],
    rules: [...graduation, ...entry],
    externalConditions: cs.externalConditions,
    unresolved: [
      "他学科の科目は、成績PDFの「情報系他学科科目」の見出しと科目マスターで識別し、学部枠（最大6単位・選択扱い）に算入します。p4注1の類似科目は算入しません。開講学科はPDFに出ないため、同名科目が複数学科にある場合は候補から判断しています。",
      `${deptLabel}の学生の実際の成績PDFでは未検証です（書式はコンピュータ科学科の成績PDFで確認）。`,
      "認定・代替科目の公式対応表は未提供。自動置換しません。",
      "資料の改訂日、在学期間等の学則条件はこのPDFから確定していません。",
      ...spec.notes,
    ],
    excludedExternal: spec.excluded.map(([name, department]) => ({
      name,
      department,
    })),
    totalRuleId: `${id}-total`,
  };
}

for (const [dept, spec] of Object.entries(DEPARTMENTS)) {
  const c = build(dept, spec);
  await writeFile(new URL(spec.out, root), JSON.stringify(c, null, 1) + "\n");
  console.log(
    `${spec.out}: 科目${c.courses.length}件・ルール${c.rules.length}件`,
  );
}

if (process.argv.includes("--check")) {
  const again = build("cs", CS_SPEC);
  const strip = (r) => ({
    id: r.id,
    assessment: r.assessment,
    expression: r.expression,
  });
  const pl = (c) => JSON.stringify(c.placements.map(({ area, ...p }) => p));
  const problems = [];
  if (pl(again) !== pl(cs)) problems.push("配置（区分・必修区分・単位）");
  if (
    JSON.stringify(again.rules.map(strip)) !==
    JSON.stringify(cs.rules.map(strip))
  )
    problems.push("ルール（ID・条件）");
  if (
    JSON.stringify(again.courses.map((x) => x.name)) !==
    JSON.stringify(cs.courses.map((x) => x.name))
  )
    problems.push("科目名");
  console.log(
    problems.length
      ? `CSの再構築と不一致: ${problems.join("、")}`
      : "CSの再構築: 既存の検証済みデータと一致",
  );
  if (problems.length) process.exitCode = 1;
}
