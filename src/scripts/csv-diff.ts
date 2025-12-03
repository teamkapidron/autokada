import * as fs from 'fs';
import * as path from 'path';

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  // Clean up Excel formulas from values
  return values.map((val) => {
    val = val.trim();
    // Remove ="..." wrapper
    if (val.startsWith('="') && val.endsWith('"')) {
      val = val.slice(2, -1);
    }
    // Remove leading = if present (for numbers)
    if (val.startsWith('=')) {
      val = val.slice(1);
    }
    // Remove surrounding quotes
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    return val;
  });
}

interface StockRowLarge {
  Varenr: string;
  Navn: string;
  Varegrupper: string;
  Lokasjon: string;
  Kostpris: string;
  'Pris eks MVA': string;
  'Antall ': string;
  Enhet: string;
}

interface StockRowSmall {
  Varenr: string;
  Navn: string;
  Lokasjon: string;
  Kostpris: string;
  'Pris eks MVA': string;
  Antall: string;
}

function parseCSVLarge(content: string): StockRowLarge[] {
  const lines = content.trim().split('\n');
  const headers = parseCSVLine(lines[0]);

  const rows: StockRowLarge[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= 6) {
      const row: any = {};
      headers.forEach((header, index) => {
        if (index < values.length) {
          row[header] = values[index];
        }
      });
      rows.push(row);
    }
  }

  return rows;
}

function parseCSVSmall(content: string): StockRowSmall[] {
  const lines = content.trim().split('\n');
  const headers = parseCSVLine(lines[0]);

  const rows: StockRowSmall[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= 6) {
      const row: any = {};
      headers.forEach((header, index) => {
        if (index < values.length) {
          row[header] = values[index];
        }
      });
      rows.push(row);
    }
  }

  return rows;
}

function escapeCSVValue(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function findDifference() {
  const distPath = path.join(__dirname, '../../dist');

  const largePath = path.join(distPath, 'stock_large.csv');
  const smallPath = path.join(distPath, 'stock_small.csv');

  console.log('Reading CSV files...');
  const largeContent = fs.readFileSync(largePath, 'utf-8');
  const smallContent = fs.readFileSync(smallPath, 'utf-8');

  console.log('Parsing CSV files...');
  const largeRows = parseCSVLarge(largeContent);
  const smallRows = parseCSVSmall(smallContent);

  console.log(`Parsed ${largeRows.length} rows from stock_large.csv`);
  console.log(`Parsed ${smallRows.length} rows from stock_small.csv`);

  // Create a set of Varenr from small CSV (normalized)
  const smallVarenrs = new Set(smallRows.map((row) => row.Varenr.trim()));
  console.log(`Small CSV has ${smallVarenrs.size} unique Varenr values`);

  // Create a set of Varenr from large CSV (normalized)
  const largeVarenrs = new Set(largeRows.map((row) => row.Varenr.trim()));
  console.log(`Large CSV has ${largeVarenrs.size} unique Varenr values`);

  // Find rows in large that are not in small
  const diffRows = largeRows.filter(
    (row) => !smallVarenrs.has(row.Varenr.trim())
  );

  console.log(
    `\nFound ${diffRows.length} rows in stock_large.csv that are not in stock_small.csv`
  );

  // Show the diff product numbers
  console.log('\nDiff product numbers:');
  diffRows.forEach((row) => console.log(`  - ${row.Varenr}: ${row.Navn}`));

  // Create output CSV with columns from stock_large
  const header =
    'Varenr,Navn,Varegrupper,Lokasjon,Kostpris,Pris eks MVA,Antall,Enhet';
  const csvLines = [header];

  for (const row of diffRows) {
    csvLines.push(
      [
        escapeCSVValue(row.Varenr),
        escapeCSVValue(row.Navn),
        escapeCSVValue(row.Varegrupper),
        escapeCSVValue(row.Lokasjon),
        escapeCSVValue(row.Kostpris),
        escapeCSVValue(row['Pris eks MVA']),
        escapeCSVValue(row['Antall ']?.trim() || ''),
        escapeCSVValue(row.Enhet || ''),
      ].join(',')
    );
  }

  const outputContent = csvLines.join('\n');

  // Write to new file
  const outputPath = path.join(distPath, 'stock_diff.csv');
  fs.writeFileSync(outputPath, outputContent, 'utf-8');

  console.log(`\n✓ Output written to: ${outputPath}`);

  // Also create the excluded products list for the data service
  const excludedPath = path.join(
    __dirname,
    '../services/data/excluded-products.txt'
  );
  const excludedContent = diffRows.map((row) => row.Varenr.trim()).join('\n');
  fs.writeFileSync(excludedPath, excludedContent, 'utf-8');

  console.log(`✓ Excluded products list written to: ${excludedPath}`);
}

findDifference().catch(console.error);
