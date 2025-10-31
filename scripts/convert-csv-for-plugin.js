/**
 * Convert CSV files to format expected by strapi-csv-import-export plugin
 * 
 * This script reads the original CSV files and converts them to match
 * the Strapi vocabulary schema field names.
 */

const fs = require('fs');
const path = require('path');

// Helper function to clean text
function cleanText(text) {
  if (!text || text === '—' || text === '-' || text.trim() === '') {
    return '';
  }
  return text.trim();
}

// Helper function to map voice
function mapVoice(pada) {
  const padaUpper = pada?.toUpperCase();
  if (padaUpper === 'P') return 'parasmaipada';
  if (padaUpper === 'A') return 'atmanepada';
  if (padaUpper === 'U') return 'ubhayapada';
  return '';
}

// Helper function to map gender
function mapGender(linga) {
  if (linga === 'm') return 'masculine';
  if (linga === 'f') return 'feminine';
  if (linga === 'n') return 'neuter';
  return '';
}

// Helper function to determine subtype
function determineSubtype(linga) {
  if (linga === 'a') return 'adjective';
  if (linga === 'p') return 'pronoun';
  if (['m', 'f', 'n'].includes(linga)) return 'noun';
  return '';
}

// Proper CSV parser that handles quoted fields
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse a CSV line respecting quotes
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

// Convert array of objects to CSV with proper escaping
function arrayToCSV(data, headers) {
  const csvLines = [];
  
  // Add header
  csvLines.push(headers.join(','));
  
  // Add rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Always quote and escape to avoid any CSV parsing issues
      // Replace any quotes with double quotes, then wrap in quotes
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvLines.push(values.join(','));
  });
  
  return csvLines.join('\n');
}

console.log('🚀 Starting CSV conversion for Strapi plugin...\n');

const spreadSheetsDir = path.join(__dirname, '../src/spread_sheets');
const outputDir = path.join(__dirname, '../src/spread_sheets/converted');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Convert Verbs
console.log('📖 Converting Verbs...');
const verbsContent = fs.readFileSync(
  path.join(spreadSheetsDir, 'Vocabulario Glide - Verbos.csv'),
  'utf-8'
);
const verbsRows = parseCSV(verbsContent);

const convertedVerbs = verbsRows.map((row, index) => ({
  word_type: 'verb',
  word_devanagari: cleanText(row['धातु']),
  root_devanagari: cleanText(row['धातु']),
  verb_class: row['गण'] && row['गण'] !== '-' ? row['गण'] : '',
  voice: mapVoice(row['पद']),
  standard_form: cleanText(row['तिङन्तं लट्']),
  meaning_pt: cleanText(row['Portugués']),
  meaning_es: cleanText(row['Español']),
  meaning_en: cleanText(row['Inglés']),
  past_imperfect: cleanText(row['लङ् / Pasado Imperfecto']),
  potential: cleanText(row['लिङ् / Potencial']),
  imperative: cleanText(row['लोट् / Imperativo']),
  past_participle: cleanText(row['लिट् / Pasado Perfecto']),
  gerund: cleanText(row['क्त्वा / Gerundio']),
  infinitive: cleanText(row['तुमुन् / Infinitivo']),
  ppp: cleanText(row['क्त / PPP']),
  itrans: cleanText(row['ITRANS']),
  iast: cleanText(row['IATS']),
  harvard_kyoto: cleanText(row['Harvard-Kyoto']),
  is_published: 'true',
  order_index: String(index + 1),
}));

const verbsHeaders = [
  'word_type', 'word_devanagari', 'root_devanagari', 'verb_class', 'voice',
  'standard_form', 'meaning_pt', 'meaning_es', 'meaning_en',
  'past_imperfect', 'potential', 'imperative', 'past_participle',
  'gerund', 'infinitive', 'ppp', 'itrans', 'iast', 'harvard_kyoto',
  'is_published', 'order_index'
];

const verbsCSV = arrayToCSV(convertedVerbs, verbsHeaders);
fs.writeFileSync(path.join(outputDir, 'verbs-for-import.csv'), verbsCSV, 'utf-8');
console.log(`  ✓ Converted ${convertedVerbs.length} verbs`);

// Convert Substantives
console.log('\n📖 Converting Substantives...');
const substantivesContent = fs.readFileSync(
  path.join(spreadSheetsDir, 'Vocabulario Glide - Sustantivos.csv'),
  'utf-8'
);
const substantivesRows = parseCSV(substantivesContent);

const convertedSubstantives = substantivesRows.map((row, index) => {
  const linga = row['लिङ्ग'];
  return {
    word_type: 'substantive',
    word_subtype: determineSubtype(linga),
    word_devanagari: cleanText(row['सुबन्तं']),
    gender: mapGender(linga),
    meaning_pt: cleanText(row['Portugués']),
    meaning_es: cleanText(row['Español']),
    meaning_en: cleanText(row['Inglés']),
    itrans: cleanText(row['ITRANS']),
    iast: cleanText(row['IATS']),
    harvard_kyoto: cleanText(row['Harvard-Kyoto']),
    is_published: 'true',
    order_index: String(index + 1),
  };
});

const substantivesHeaders = [
  'word_type', 'word_subtype', 'word_devanagari', 'gender',
  'meaning_pt', 'meaning_es', 'meaning_en',
  'itrans', 'iast', 'harvard_kyoto', 'is_published', 'order_index'
];

const substantivesCSV = arrayToCSV(convertedSubstantives, substantivesHeaders);
fs.writeFileSync(path.join(outputDir, 'substantives-for-import.csv'), substantivesCSV, 'utf-8');
console.log(`  ✓ Converted ${convertedSubstantives.length} substantives`);

// Convert Indeclinables
console.log('\n📖 Converting Indeclinables...');
const indeclinablesContent = fs.readFileSync(
  path.join(spreadSheetsDir, 'Vocabulario Glide - Indeclinables.csv'),
  'utf-8'
);
const indeclinablesRows = parseCSV(indeclinablesContent);

const convertedIndeclinables = indeclinablesRows.map((row, index) => ({
  word_type: 'indeclinable',
  word_devanagari: cleanText(row['अव्यय']),
  grammatical_case: cleanText(row['विभक्ति']),
  meaning_pt: cleanText(row['Portugues']),
  meaning_es: cleanText(row['Español']),
  meaning_en: cleanText(row['Inglés']),
  itrans: cleanText(row['ITRANS']),
  iast: cleanText(row['IATS']),
  harvard_kyoto: cleanText(row['Harvard-Kyoto']),
  is_published: 'true',
  order_index: String(index + 1),
}));

const indeclinablesHeaders = [
  'word_type', 'word_devanagari', 'grammatical_case',
  'meaning_pt', 'meaning_es', 'meaning_en',
  'itrans', 'iast', 'harvard_kyoto', 'is_published', 'order_index'
];

const indeclinablesCSV = arrayToCSV(convertedIndeclinables, indeclinablesHeaders);
fs.writeFileSync(path.join(outputDir, 'indeclinables-for-import.csv'), indeclinablesCSV, 'utf-8');
console.log(`  ✓ Converted ${convertedIndeclinables.length} indeclinables`);

// Summary
console.log('\n' + '='.repeat(60));
console.log('✅ CONVERSION COMPLETE');
console.log('='.repeat(60));
console.log(`\nConverted files saved to: ${outputDir}`);
console.log('\nFiles created:');
console.log(`  1. verbs-for-import.csv (${convertedVerbs.length} entries)`);
console.log(`  2. substantives-for-import.csv (${convertedSubstantives.length} entries)`);
console.log(`  3. indeclinables-for-import.csv (${convertedIndeclinables.length} entries)`);
console.log(`\nTotal: ${convertedVerbs.length + convertedSubstantives.length + convertedIndeclinables.length} entries`);
console.log('\n📝 Next steps:');
console.log('  1. Restart Strapi: npm run develop');
console.log('  2. Go to http://localhost:1337/admin');
console.log('  3. Click "CSV Import Export" in the sidebar');
console.log('  4. Import each file one by one');
console.log('='.repeat(60));
