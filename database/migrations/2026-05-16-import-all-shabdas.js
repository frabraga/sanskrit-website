const fs = require("fs");
const path = require("path");

const SCRIPTS = path.join(__dirname, "../../scripts");

function cleanText(text) {
  if (!text || text === "–" || text === "-" || text === "—" || text.trim() === "") {
    return undefined;
  }
  return text.trim();
}

// Character-by-character CSV parser — handles multi-line quoted fields correctly
function parseCSV(content) {
  const records = [];
  let headers = null;
  let fields = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  const flush = () => { fields.push(current.trim()); current = ""; };

  while (i <= content.length) {
    const ch = content[i];
    const next = content[i + 1];

    if (i === content.length) {
      flush();
      if (fields.some((f) => f !== "")) {
        if (!headers) { headers = fields; }
        else {
          const row = {};
          headers.forEach((h, idx) => (row[h] = fields[idx] ?? ""));
          records.push(row);
        }
      }
      break;
    }

    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i += 2; continue; }
      inQuotes = !inQuotes; i++; continue;
    }
    if (ch === "," && !inQuotes) { flush(); i++; continue; }
    if ((ch === "\r" || ch === "\n") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      flush();
      if (fields.some((f) => f !== "")) {
        if (!headers) { headers = fields; }
        else {
          const row = {};
          headers.forEach((h, idx) => (row[h] = fields[idx] ?? ""));
          records.push(row);
        }
      }
      fields = []; i++; continue;
    }
    current += ch; i++;
  }

  return records;
}

// Declension table for Substantivos and Numerais (8 cases × 3 numbers)
function createDeclensions(row) {
  return [
    { case_label: "1", singular: row.nom_s, dual: row.nom_d, plural: row.nom_p },
    { case_label: "V", singular: row.voc_s, dual: row.voc_d, plural: row.voc_p },
    { case_label: "2", singular: row.acc_s, dual: row.acc_d, plural: row.acc_p },
    { case_label: "3", singular: row.ins_s, dual: row.ins_d, plural: row.ins_p },
    { case_label: "4", singular: row.dat_s, dual: row.dat_d, plural: row.dat_p },
    { case_label: "5", singular: row.abl_s, dual: row.abl_d, plural: row.abl_p },
    { case_label: "6", singular: row.gen_s, dual: row.gen_d, plural: row.gen_p },
    { case_label: "7", singular: row.loc_s, dual: row.loc_d, plural: row.loc_p },
  ]
    .map((m) => ({
      case_label: m.case_label,
      singular: cleanText(m.singular),
      dual: cleanText(m.dual),
      plural: cleanText(m.plural),
    }))
    .filter((m) => m.singular || m.dual || m.plural);
}

// Conjugation table for Verbos (3 persons × 3 numbers)
// Sanskrit grammatical persons: 1 = prathama (3rd Western), 2 = madhyama (2nd), 3 = uttama (1st)
function createConjugations(row) {
  return [
    { case_label: "1", singular: row["1/s"], dual: row["1/d"], plural: row["1/p"] },
    { case_label: "2", singular: row["2/s"], dual: row["2/d"], plural: row["2/p"] },
    { case_label: "3", singular: row["3/s"], dual: row["3/d"], plural: row["3/p"] },
  ]
    .map((m) => ({
      case_label: m.case_label,
      singular: cleanText(m.singular),
      dual: cleanText(m.dual),
      plural: cleanText(m.plural),
    }))
    .filter((m) => m.singular || m.dual || m.plural);
}

// Numerais rows have ORDER only on one row per gender group.
// This groups consecutive rows that share a title and resolves the ORDER for the whole group.
function resolveNumeraisGroups(rows) {
  const resolved = [];
  let groupRows = [];
  let lastTitle = null;

  const flushGroup = () => {
    if (groupRows.length === 0) return;
    const order = groupRows.reduce((found, r) => {
      const v = parseInt(r["ORDER"], 10);
      return found ?? (isNaN(v) ? null : v);
    }, null);
    for (const r of groupRows) resolved.push({ ...r, _resolvedOrder: order, _resolvedTitle: lastTitle });
    groupRows = [];
  };

  for (const row of rows) {
    const title = row["Title"]?.trim();
    if (title && title !== lastTitle) {
      flushGroup();
      lastTitle = title;
    }
    groupRows.push(row);
  }
  flushGroup();

  return resolved;
}

async function importRows(rows, buildEntry, label) {
  let imported = 0;
  let skipped = 0;
  for (const [i, row] of rows.entries()) {
    try {
      const entry = buildEntry(row);
      if (!entry) { skipped++; continue; }
      await strapi.entityService.create("api::shabda.shabda", { data: entry });
      imported++;
      if (imported % 10 === 0 || imported === rows.length) {
        console.log(`  [${label}] ${imported}/${rows.length} imported`);
      }
    } catch (err) {
      console.error(`  [${label}] row ${i + 1} error: ${err.message}`);
      skipped++;
    }
  }
  return { imported, skipped };
}

module.exports = {
  async up() {
    console.log("\n🚀 Starting Full Shabda Import (Substantivos + Numerais + Verbos)...\n");

    await strapi.db.transaction(async () => {
      // ── Wipe ──────────────────────────────────────────────────────────────
      console.log("🗑️  Clearing all existing Shabda entries...");
      const existing = await strapi.entityService.findMany("api::shabda.shabda", { limit: -1 });
      for (const e of existing) await strapi.entityService.delete("api::shabda.shabda", e.id);
      console.log(`  ✓ Deleted ${existing.length} entries\n`);

      const totals = { imported: 0, skipped: 0 };

      // ── 1. Substantivos ───────────────────────────────────────────────────
      console.log("📖 Importing Substantivos...");
      const subRows = parseCSV(fs.readFileSync(path.join(SCRIPTS, "Compilado tabelas strapi - Substantivos.csv"), "utf-8"));
      const subResult = await importRows(subRows, (row) => {
        if (!row["Title"]?.trim()) return null;
        const order = parseInt(row["ORDER"], 10);
        return {
          title: row["Title"].trim(),
          category: cleanText(row["categoria"]),
          prakarana_label: cleanText(row["prakarana_label"]),
          order_index: isNaN(order) ? undefined : order,
          commentary: cleanText(row["COMENTÁRIO"]),
          is_published: true,
          declensions: createDeclensions(row),
        };
      }, "Substantivos");
      totals.imported += subResult.imported;
      totals.skipped += subResult.skipped;

      // ── 2. Numerais ───────────────────────────────────────────────────────
      console.log("\n📖 Importing Numerais...");
      const numRaw = parseCSV(fs.readFileSync(path.join(SCRIPTS, "Compilado tabelas strapi - Numerais.csv"), "utf-8"));
      const numRows = resolveNumeraisGroups(numRaw);
      const numResult = await importRows(numRows, (row) => {
        if (!row["_resolvedTitle"]) return null;
        return {
          title: row["_resolvedTitle"],
          category: cleanText(row["categoria"]),
          prakarana_label: cleanText(row["prakarana_label"]),
          order_index: row["_resolvedOrder"] ?? undefined,
          commentary: cleanText(row["COMENTÁRIO"]),
          is_published: true,
          declensions: createDeclensions(row),
        };
      }, "Numerais");
      totals.imported += numResult.imported;
      totals.skipped += numResult.skipped;

      // ── 3. Verbos ─────────────────────────────────────────────────────────
      console.log("\n📖 Importing Verbos...");
      const verbRows = parseCSV(fs.readFileSync(path.join(SCRIPTS, "Compilado tabelas strapi - verbos.csv"), "utf-8"));
      const verbResult = await importRows(verbRows, (row) => {
        if (!row["Title"]?.trim()) return null;
        const order = parseInt(row["ORDER"], 10);
        return {
          title: row["Title"].trim(),
          category: cleanText(row["categoria"]),
          prakarana_label: cleanText(row["prakarana_label"]),
          order_index: isNaN(order) ? undefined : order,
          commentary: cleanText(row["COMENTÁRIO"]),
          is_published: true,
          declensions: createConjugations(row),
        };
      }, "Verbos");
      totals.imported += verbResult.imported;
      totals.skipped += verbResult.skipped;

      // ── Summary ───────────────────────────────────────────────────────────
      console.log("\n" + "=".repeat(60));
      console.log("✅ FULL SHABDA IMPORT COMPLETE");
      console.log("=".repeat(60));
      console.log(`  Substantivos : ${subResult.imported}`);
      console.log(`  Numerais     : ${numResult.imported}`);
      console.log(`  Verbos       : ${verbResult.imported}`);
      console.log(`  Total        : ${totals.imported} imported, ${totals.skipped} skipped`);
      console.log("=".repeat(60) + "\n");
    });
  },

  async down() {
    console.log("\n🔄 Rolling back Full Shabda Import...\n");
    await strapi.db.transaction(async () => {
      const entries = await strapi.entityService.findMany("api::shabda.shabda", { limit: -1 });
      for (const e of entries) await strapi.entityService.delete("api::shabda.shabda", e.id);
      console.log(`✓ Deleted ${entries.length} shabda entries\n`);
    });
  },
};
