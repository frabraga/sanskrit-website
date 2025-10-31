/**
 * Vocabulary Import Migration
 * 
 * This migration imports vocabulary data from CSV files into the database.
 * Run with: npm run strapi migrate
 */

const fs = require('fs');
const path = require('path');

// Helper functions
function cleanText(text) {
  if (!text || text === '—' || text === '-' || text.trim() === '') {
    return undefined;
  }
  return text.trim();
}

function mapVoice(pada) {
  const padaUpper = pada?.toUpperCase();
  if (padaUpper === 'P') return 'parasmaipada';
  if (padaUpper === 'A') return 'atmanepada';
  if (padaUpper === 'U') return 'ubhayapada';
  return undefined;
}

function mapGender(linga) {
  if (linga === 'm') return 'masculine';
  if (linga === 'f') return 'feminine';
  if (linga === 'n') return 'neuter';
  return undefined;
}

function determineSubtype(linga) {
  if (linga === 'a') return 'adjective';
  if (linga === 'p') return 'pronoun';
  if (['m', 'f', 'n'].includes(linga)) return 'noun';
  return undefined;
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse CSV properly handling quoted fields
  function parseLine(line) {
    const values = [];
    let current = '';
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
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current.trim());
        current = '';
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
    const hasContent = values.some(val => val && val.trim() !== '');
    if (!hasContent) {
      continue;
    }
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }

  return rows;
}

module.exports = {
  async up() {
    console.log('\n🚀 Starting Vocabulary Import Migration...\n');
    
    await strapi.db.transaction(async () => {
      const spreadSheetsDir = path.join(__dirname, '../../src/spread_sheets/converted');
      
      const stats = {
        verbs: 0,
        substantives: 0,
        indeclinables: 0,
      };

      // Import Verbs
      try {
        console.log('📖 Importing Verbs...');
        const filePath = path.join(spreadSheetsDir, 'verbs-for-import.csv');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const rows = parseCSV(fileContent);

        for (const row of rows) {
          // Skip if word_devanagari is empty
          if (!row.word_devanagari || row.word_devanagari.trim() === '') {
            continue;
          }
          
          await strapi.entityService.create('api::vocabulary.vocabulary', {
            data: {
              word_type: row.word_type,
              word_devanagari: row.word_devanagari,
              root_devanagari: cleanText(row.root_devanagari),
              verb_class: row.verb_class ? parseInt(row.verb_class) : undefined,
              voice: cleanText(row.voice),
              standard_form: cleanText(row.standard_form),
              meaning_pt: cleanText(row.meaning_pt),
              meaning_es: cleanText(row.meaning_es),
              meaning_en: cleanText(row.meaning_en),
              past_imperfect: cleanText(row.past_imperfect),
              potential: cleanText(row.potential),
              imperative: cleanText(row.imperative),
              past_participle: cleanText(row.past_participle),
              gerund: cleanText(row.gerund),
              infinitive: cleanText(row.infinitive),
              ppp: cleanText(row.ppp),
              itrans: cleanText(row.itrans),
              iast: cleanText(row.iast),
              harvard_kyoto: cleanText(row.harvard_kyoto),
              is_published: row.is_published === 'true',
              order_index: row.order_index ? parseInt(row.order_index) : undefined,
            },
          });
          stats.verbs++;
        }
        console.log(`  ✓ Imported ${stats.verbs} verbs`);
      } catch (error) {
        console.error('❌ Error importing verbs:', error.message);
        throw error;
      }

      // Import Substantives
      try {
        console.log('\n📖 Importing Substantives...');
        const filePath = path.join(spreadSheetsDir, 'substantives-for-import.csv');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const rows = parseCSV(fileContent);

        for (const row of rows) {
          // Skip if word_devanagari is empty
          if (!row.word_devanagari || row.word_devanagari.trim() === '') {
            continue;
          }
          
          await strapi.entityService.create('api::vocabulary.vocabulary', {
            data: {
              word_type: row.word_type,
              word_subtype: cleanText(row.word_subtype),
              word_devanagari: row.word_devanagari,
              gender: cleanText(row.gender),
              meaning_pt: cleanText(row.meaning_pt),
              meaning_es: cleanText(row.meaning_es),
              meaning_en: cleanText(row.meaning_en),
              itrans: cleanText(row.itrans),
              iast: cleanText(row.iast),
              harvard_kyoto: cleanText(row.harvard_kyoto),
              is_published: row.is_published === 'true',
              order_index: row.order_index ? parseInt(row.order_index) : undefined,
            },
          });
          stats.substantives++;
        }
        console.log(`  ✓ Imported ${stats.substantives} substantives`);
      } catch (error) {
        console.error('❌ Error importing substantives:', error.message);
        throw error;
      }

      // Import Indeclinables
      try {
        console.log('\n📖 Importing Indeclinables...');
        const filePath = path.join(spreadSheetsDir, 'indeclinables-for-import.csv');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const rows = parseCSV(fileContent);

        for (const row of rows) {
          // Skip if word_devanagari is empty
          if (!row.word_devanagari || row.word_devanagari.trim() === '') {
            continue;
          }
          
          await strapi.entityService.create('api::vocabulary.vocabulary', {
            data: {
              word_type: row.word_type,
              word_devanagari: row.word_devanagari,
              grammatical_case: cleanText(row.grammatical_case),
              meaning_pt: cleanText(row.meaning_pt),
              meaning_es: cleanText(row.meaning_es),
              meaning_en: cleanText(row.meaning_en),
              itrans: cleanText(row.itrans),
              iast: cleanText(row.iast),
              harvard_kyoto: cleanText(row.harvard_kyoto),
              is_published: row.is_published === 'true',
              order_index: row.order_index ? parseInt(row.order_index) : undefined,
            },
          });
          stats.indeclinables++;
        }
        console.log(`  ✓ Imported ${stats.indeclinables} indeclinables`);
      } catch (error) {
        console.error('❌ Error importing indeclinables:', error.message);
        throw error;
      }

      // Summary
      const total = stats.verbs + stats.substantives + stats.indeclinables;
      console.log('\n' + '='.repeat(60));
      console.log('✅ IMPORT COMPLETE');
      console.log('='.repeat(60));
      console.log(`\nTotal entries imported: ${total}`);
      console.log(`  - Verbs: ${stats.verbs}`);
      console.log(`  - Substantives: ${stats.substantives}`);
      console.log(`  - Indeclinables: ${stats.indeclinables}`);
      console.log('='.repeat(60) + '\n');
    });
  },

  async down() {
    console.log('\n🔄 Rolling back Vocabulary Import...\n');
    
    await strapi.db.transaction(async () => {
      // Delete all vocabulary entries
      const entries = await strapi.entityService.findMany('api::vocabulary.vocabulary', {
        limit: -1, // Get all entries
      });

      for (const entry of entries) {
        await strapi.entityService.delete('api::vocabulary.vocabulary', entry.id);
      }

      console.log(`✓ Deleted ${entries.length} vocabulary entries\n`);
    });
  },
};
