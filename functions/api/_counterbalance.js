import { cleanText, nullableText, safeJson } from "./_utils.js";

const L1_ORDER = ["AME", "JPN", "CHN"];
const CONSTRAINED_RUN_L1 = new Set(["AME", "JPN"]);
const MAX_CONSTRAINED_RUN = 2;
const LIST_COMBINATIONS = [
  "ABCD",
  "BCDE",
  "CDEF",
  "DEFG",
  "EFGH",
  "FGHI",
  "GHIJ",
  "HIJA",
  "IJAB",
  "JABC",
];

const LIST_SPECS = {
  A: { AME: range(1, 5), JPN: range(6, 15), CHN: range(16, 25) },
  B: { AME: range(26, 30), JPN: range(31, 40), CHN: range(41, 50) },
  C: { AME: range(6, 10), JPN: range(11, 20), CHN: [...range(21, 25), ...range(1, 5)] },
  D: { AME: range(31, 35), JPN: range(36, 45), CHN: [...range(46, 50), ...range(26, 30)] },
  E: { AME: range(11, 15), JPN: range(16, 25), CHN: range(1, 10) },
  F: { AME: range(36, 40), JPN: range(41, 50), CHN: range(26, 35) },
  G: { AME: range(16, 20), JPN: [...range(21, 25), ...range(1, 5)], CHN: range(6, 15) },
  H: { AME: range(41, 45), JPN: [...range(46, 50), ...range(26, 30)], CHN: range(31, 40) },
  I: { AME: range(21, 25), JPN: range(1, 10), CHN: range(11, 20) },
  J: { AME: range(46, 50), JPN: range(26, 35), CHN: range(36, 45) },
};

export const COUNTERBALANCE_CELLS = [
  ...LIST_COMBINATIONS.map((listComb, index) => ({
    cell_id: index + 1,
    list_comb: listComb,
    pronunciation_style: "a",
  })),
  ...LIST_COMBINATIONS.map((listComb, index) => ({
    cell_id: index + 11,
    list_comb: listComb,
    pronunciation_style: "b",
  })),
];

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function hashString(value) {
  let h = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, seedText) {
  const out = items.slice();
  const rng = mulberry32(hashString(seedText));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function itemL1(item) {
  return cleanText(item.l1_condition || item.native_language).toUpperCase();
}

function hasLongConstrainedRun(items) {
  let previous = "";
  let runLength = 0;
  for (const item of items) {
    const current = itemL1(item);
    if (current === previous) {
      runLength += 1;
    } else {
      previous = current;
      runLength = 1;
    }
    if (CONSTRAINED_RUN_L1.has(current) && runLength > MAX_CONSTRAINED_RUN) {
      return true;
    }
  }
  return false;
}

function wouldCreateLongConstrainedRun(output, l1) {
  if (!CONSTRAINED_RUN_L1.has(l1)) return false;
  if (output.length < MAX_CONSTRAINED_RUN) return false;
  return output
    .slice(-MAX_CONSTRAINED_RUN)
    .every((item) => itemL1(item) === l1);
}

function remainingCount(groups, l1) {
  return groups.get(l1)?.length || 0;
}

function chooseConstrainedL1(groups, output, rng) {
  const totalRemaining = [...groups.values()].reduce((sum, group) => sum + group.length, 0);
  const choices = [...groups.keys()].filter((l1) => {
    if (!remainingCount(groups, l1)) return false;
    return !wouldCreateLongConstrainedRun(output, l1);
  });
  if (!choices.length) return "";

  let best = "";
  let bestScore = -Infinity;
  for (const l1 of choices) {
    const count = remainingCount(groups, l1);
    const others = totalRemaining - count;
    const pressure = CONSTRAINED_RUN_L1.has(l1)
      ? count / Math.max(1, MAX_CONSTRAINED_RUN * (others + 1))
      : count / Math.max(1, totalRemaining);
    const score = pressure * 1000 + count + rng();
    if (score > bestScore) {
      best = l1;
      bestScore = score;
    }
  }
  return best;
}

function constrainedShuffleByL1(items, seedText) {
  const initiallyShuffled = shuffle(items, seedText);
  if (!hasLongConstrainedRun(initiallyShuffled)) return initiallyShuffled;

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const rng = mulberry32(hashString(`${seedText}:constrained:${attempt}`));
    const groups = new Map();
    for (const item of shuffle(items, `${seedText}:groups:${attempt}`)) {
      const l1 = itemL1(item) || "UNKNOWN";
      if (!groups.has(l1)) groups.set(l1, []);
      groups.get(l1).push(item);
    }

    const output = [];
    while (output.length < items.length) {
      const l1 = chooseConstrainedL1(groups, output, rng);
      if (!l1) break;
      output.push(groups.get(l1).pop());
    }
    if (output.length === items.length && !hasLongConstrainedRun(output)) {
      return output;
    }
  }

  throw new Error("Could not create a randomized order without 3 consecutive AME or JPN trials.");
}

function pickOne(items, seedText) {
  if (!items.length) return null;
  const rng = mulberry32(hashString(seedText));
  return items[Math.floor(rng() * items.length)];
}

function readField(row, names) {
  for (const name of names) {
    const normalized = name.toLowerCase();
    if (row?.[name] !== undefined && cleanText(row[name])) return cleanText(row[name]);
    if (row?.[normalized] !== undefined && cleanText(row[normalized])) {
      return cleanText(row[normalized]);
    }
  }
  return "";
}

export function normalizeL1(value) {
  const text = cleanText(value).toLowerCase();
  if (["ame", "american", "us", "usa", "english", "native_english"].includes(text)) {
    return "AME";
  }
  if (["jpn", "jp", "japanese", "japan"].includes(text)) return "JPN";
  if (["chn", "cn", "zh", "chinese", "china", "mandarin"].includes(text)) return "CHN";
  return "";
}

export function normalizePronunciation(value) {
  const text = cleanText(value).toLowerCase().replace(/[_\s-]+/g, "");
  if (["natural", "nat", "native", "nativelike"].includes(text)) return "natural";
  if (["accented", "accent", "strongaccent", "mildaccent", "nonnative"].includes(text)) {
    return "accented";
  }
  return "";
}

function expectedPronunciation(l1, wordNumber, pronunciationStyle) {
  if (l1 === "AME") return "accented";
  const odd = wordNumber % 2 === 1;
  const oddNatural = pronunciationStyle === "a";
  return odd === oddNatural ? "natural" : "accented";
}

function normalizeMaterial(item, index) {
  const wordNumber = Number.parseInt(
    readField(item, ["word_number", "word_id", "item_id", "word_no"]),
    10,
  );
  const l1 = normalizeL1(
    readField(item, ["l1_condition", "l1", "native_language", "native", "speaker_l1"]),
  );
  const pronunciation = normalizePronunciation(
    readField(item, [
      "pronunciation_condition",
      "pronunciation",
      "accent_condition",
      "accent",
      "style",
    ]),
  );
  const stimulusList = cleanText(
    readField(item, ["stimulus_list", "list", "list_id", "counterbalance_list"]),
  ).toUpperCase();
  return {
    ...item,
    _source_index: index,
    _word_number_number: Number.isFinite(wordNumber) ? wordNumber : null,
    _l1_condition: l1,
    _pronunciation_condition: pronunciation,
    _stimulus_list: /^[A-J]$/.test(stimulusList) ? stimulusList : "",
  };
}

function materialMatches(material, stimulusList, l1, wordNumber, expected) {
  if (material._stimulus_list && material._stimulus_list !== stimulusList) return false;
  if (material._l1_condition !== l1) return false;
  if (material._word_number_number !== wordNumber) return false;
  if (l1 === "AME") {
    return !material._pronunciation_condition || material._pronunciation_condition === "accented";
  }
  return material._pronunciation_condition === expected;
}

function canonicalizeAssignmentItem(item, metadata) {
  return {
    ...item,
    file: undefined,
    phase: "main",
    practice_kind: "",
    practice_group: "",
    counterbalance_cell: String(metadata.cell.cell_id),
    list_comb: metadata.cell.list_comb,
    pronunciation_style: metadata.cell.pronunciation_style,
    stimulus_list: metadata.stimulus_list,
    l1_condition: metadata.l1,
    pronunciation_condition: metadata.expected_pronunciation,
    native_language: metadata.l1,
    accent_condition: metadata.expected_pronunciation,
    word_number: String(metadata.word_number),
  };
}

export async function ensureCounterbalanceCells(db) {
  const statements = COUNTERBALANCE_CELLS.map((cell) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO counterbalance_cells (
          cell_id, list_comb, pronunciation_style
        ) VALUES (?, ?, ?)`,
      )
      .bind(cell.cell_id, cell.list_comb, cell.pronunciation_style),
  );
  await db.batch(statements);
}

export async function allocateCounterbalance(db, sessionId, assignedAt) {
  await ensureCounterbalanceCells(db);
  const allocationId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO counterbalance_allocations (
        id, session_id, cell_id, status, assigned_at, updated_at
      )
      SELECT ?, ?, c.cell_id, 'started', ?, ?
      FROM counterbalance_cells c
      ORDER BY
        (
          SELECT COUNT(*)
          FROM counterbalance_allocations ca
          WHERE ca.cell_id = c.cell_id
            AND ca.status = 'completed'
        ) ASC,
        (
          SELECT COUNT(*)
          FROM counterbalance_allocations ca
          WHERE ca.cell_id = c.cell_id
        ) ASC,
        c.cell_id ASC
      LIMIT 1`,
    )
    .bind(allocationId, sessionId, assignedAt, assignedAt)
    .run();

  const row = await db
    .prepare(
      `SELECT
        ca.id AS allocation_id,
        c.cell_id,
        c.list_comb,
        c.pronunciation_style
       FROM counterbalance_allocations ca
       JOIN counterbalance_cells c ON c.cell_id = ca.cell_id
       WHERE ca.id = ?`,
    )
    .bind(allocationId)
    .first();

  if (!row) {
    throw new Error("Could not allocate a counterbalance cell.");
  }
  return {
    allocation_id: row.allocation_id,
    cell_id: Number(row.cell_id),
    list_comb: row.list_comb,
    pronunciation_style: row.pronunciation_style,
  };
}

export function buildCounterbalancedAssignment(materials, cell, seedText) {
  if (!Array.isArray(materials) || !materials.length) {
    throw new Error("counterbalance materials are required.");
  }
  const normalized = materials.map(normalizeMaterial);
  const selected = [];
  const missing = [];

  for (const stimulusList of cell.list_comb.split("")) {
    const spec = LIST_SPECS[stimulusList];
    if (!spec) throw new Error(`Unknown counterbalance list: ${stimulusList}`);
    for (const l1 of L1_ORDER) {
      for (const wordNumber of spec[l1]) {
        const expected = expectedPronunciation(l1, wordNumber, cell.pronunciation_style);
        const candidates = normalized.filter((item) =>
          materialMatches(item, stimulusList, l1, wordNumber, expected),
        );
        const picked = pickOne(
          candidates,
          `${seedText}:${cell.cell_id}:${stimulusList}:${l1}:${wordNumber}:${expected}`,
        );
        if (!picked) {
          missing.push(`${stimulusList}/${l1}/word${wordNumber}/${expected}`);
          continue;
        }
        selected.push(
          canonicalizeAssignmentItem(picked, {
            cell,
            stimulus_list: stimulusList,
            l1,
            word_number: wordNumber,
            expected_pronunciation: expected,
          }),
        );
      }
    }
  }

  if (missing.length) {
    throw new Error(`Missing counterbalance materials: ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ", ..." : ""}`);
  }

  const shuffled = constrainedShuffleByL1(selected, `${seedText}:${cell.cell_id}:main-order`);
  return shuffled.map((item, index) => ({
    ...item,
    trial_index: index + 1,
  }));
}

export function counterbalancePayload(cell) {
  if (!cell) return null;
  return {
    allocation_id: nullableText(cell.allocation_id),
    counterbalance_cell: cell.cell_id,
    list_comb: cell.list_comb,
    pronunciation_style: cell.pronunciation_style,
  };
}

export function safeMaterialsJson(materials) {
  return safeJson({ material_count: Array.isArray(materials) ? materials.length : 0 });
}
