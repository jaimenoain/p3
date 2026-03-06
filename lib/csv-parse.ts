/**
 * Pure CSV parsing and USD-only validation for Phase 5 ingestion.
 * No I/O; used by parseCsvMutation and verification scripts.
 */

export type ParsedCsvRow = Record<string, string>;

export type ParseCsvResult =
  | { ok: true; rows: ParsedCsvRow[]; headers: string[] }
  | { ok: false; error: string };

const NON_USD_CURRENCY_PATTERN =
  /\b(EUR|GBP|CAD|CHF|JPY|AUD|CNY|INR|MXN|BRL|ZAR)\b|€|£|¥|₹|R\$\s|C\$\s|A\$\s/i;

const MULTI_CURRENCY_ERROR =
  "File contains non-USD currency markers (e.g. EUR, €, GBP, £). V1 supports USD only. Please upload a USD-only file.";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i += 1;
      let field = "";
      while (i < line.length) {
        if (line[i] === '"') {
          i += 1;
          if (line[i] === '"') {
            field += '"';
            i += 1;
          } else break;
        } else {
          field += line[i];
          i += 1;
        }
      }
      out.push(field);
    } else {
      const comma = line.indexOf(",", i);
      const end = comma === -1 ? line.length : comma;
      out.push(line.slice(i, end).trim());
      i = comma === -1 ? line.length : comma + 1;
    }
  }
  return out;
}

function parseCsvToRows(csvText: string): { headers: string[]; rows: ParsedCsvRow[] } {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows: ParsedCsvRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const values = parseCsvLine(lines[r]);
    const row: ParsedCsvRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function containsNonUsdCurrency(text: string): boolean {
  return NON_USD_CURRENCY_PATTERN.test(text);
}

export function parseAndValidateCsv(csvText: string): ParseCsvResult {
  const { headers, rows } = parseCsvToRows(csvText);
  for (const h of headers) {
    if (containsNonUsdCurrency(h)) {
      return { ok: false, error: MULTI_CURRENCY_ERROR };
    }
  }
  for (let r = 0; r < rows.length; r++) {
    for (const value of Object.values(rows[r])) {
      if (containsNonUsdCurrency(value)) {
        return { ok: false, error: MULTI_CURRENCY_ERROR };
      }
    }
  }
  return { ok: true, rows, headers };
}
