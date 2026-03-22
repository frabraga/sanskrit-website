/**
 * Shabda Import Migration
 *
 * This migration imports Shabda data from the Substantivos CSV file into the database.
 * Run with: npm run strapi migrate
 */

const fs = require("fs");
const path = require("path");

// Helper function to clean text
function cleanText(text) {
  if (!text || text === "—" || text === "-" || text.trim() === "") {
    return undefined;
  }
  return text.trim();
}

// Function to parse CSV properly handling quoted fields
function parseCSV(content) {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return [];

  function parseLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        // End of field
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    // Add last field
    values.push(current.trim());
    return values;
  }

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);

    // Skip empty rows (all values are empty or whitespace)
    const hasContent = values.some((val) => val && val.trim() !== "");
    if (!hasContent) {
      continue;
    }

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    rows.push(row);
  }

  return rows;
}

// Function to create declensions object from CSV row
function createDeclensions(row) {
  const declensions = [];

  // Mapping of CSV columns to declension structure
  const caseMappings = [
    {
      case: "1",
      singular: row.nom_s,
      dual: row.nom_d,
      plural: row.nom_p,
    },
    {
      case: "V",
      singular: row.voc_s,
      dual: row.voc_d,
      plural: row.voc_p,
    },
    {
      case: "2",
      singular: row.acc_s,
      dual: row.acc_d,
      plural: row.acc_p,
    },
    {
      case: "3",
      singular: row.ins_s,
      dual: row.ins_d,
      plural: row.ins_p,
    },
    { case: "4", singular: row.dat_s, dual: row.dat_d, plural: row.dat_p },
    {
      case: "5",
      singular: row.abl_s,
      dual: row.abl_d,
      plural: row.abl_p,
    },
    {
      case: "6",
      singular: row.gen_s,
      dual: row.gen_d,
      plural: row.gen_p,
    },
    {
      case: "7",
      singular: row.loc_s,
      dual: row.loc_d,
      plural: row.loc_p,
    },
  ];

  caseMappings.forEach((mapping) => {
    if (mapping.singular || mapping.dual || mapping.plural) {
      declensions.push({
        case_label: mapping.case,
        singular: cleanText(mapping.singular),
        dual: cleanText(mapping.dual),
        plural: cleanText(mapping.plural),
      });
    }
  });

  return declensions;
}

module.exports = {
  async up() {
    console.log("\n🚀 Starting Shabda Import Migration...\n");

    await strapi.db.transaction(async () => {
      // First, clear all existing shabda entries
      console.log("🗑️  Clearing existing Shabda entries...");
      const existingEntries = await strapi.entityService.findMany(
        "api::shabda.shabda",
        {
          limit: -1, // Get all entries
        },
      );

      for (const entry of existingEntries) {
        await strapi.entityService.delete("api::shabda.shabda", entry.id);
      }

      console.log(`  ✓ Deleted ${existingEntries.length} existing entries\n`);

      // Path to the CSV file
      const filePath =
        "/Users/chico/Downloads/Copy of Shabda Manjari Strapi - Substantivos (1).csv";

      try {
        console.log("📖 Reading CSV file...");
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const rows = parseCSV(fileContent);

        console.log(`📊 Found ${rows.length} rows to process`);

        let importedCount = 0;
        let skippedCount = 0;

        for (const [index, row] of rows.entries()) {
          // Skip if Title is empty
          if (!row.Title || row.Title.trim() === "") {
            console.log(`  ⏭️  Skipping row ${index + 1}: Empty title`);
            skippedCount++;
            continue;
          }

          try {
            // Create declensions array
            const declensions = createDeclensions(row);

            // Create the Shabda entry
            await strapi.entityService.create("api::shabda.shabda", {
              data: {
                title: cleanText(row.Title),
                category: cleanText(row.categoria),
                prakarana_label: cleanText(row.prakarana_label),
                is_published: true, // Set to true by default
                order_index: importedCount + 1, // Use import order as index
                declensions: declensions,
              },
            });

            importedCount++;
            console.log(
              `  ✓ Imported (${importedCount}/${rows.length}): ${row.Title}`,
            );
          } catch (error) {
            console.error(
              `  ❌ Error importing row ${index + 1} (${row.Title}):`,
              error.message,
            );
            skippedCount++;
          }
        }

        // Summary
        console.log("\n" + "=".repeat(60));
        console.log("✅ SHABDA IMPORT COMPLETE");
        console.log("=".repeat(60));
        console.log(`\nTotal entries processed: ${rows.length}`);
        console.log(`  ✓ Successfully imported: ${importedCount}`);
        console.log(`  ⏭️  Skipped: ${skippedCount}`);
        console.log("=".repeat(60) + "\n");
      } catch (error) {
        console.error(
          "❌ Error reading or processing CSV file:",
          error.message,
        );
        throw error;
      }
    });
  },

  async down() {
    console.log("\n🔄 Rolling back Shabda Import...\n");

    await strapi.db.transaction(async () => {
      // Delete all shabda entries created by this migration
      const entries = await strapi.entityService.findMany(
        "api::shabda.shabda",
        {
          limit: -1, // Get all entries
        },
      );

      for (const entry of entries) {
        await strapi.entityService.delete("api::shabda.shabda", entry.id);
      }

      console.log(`✓ Deleted ${entries.length} shabda entries\n`);
    });
  },
};
