/**
 * Minimal RFC-4180 CSV parser. The TV Time export is well-formed (quoted
 * fields wrap embedded commas/newlines), so a standard parser is enough and we
 * avoid a runtime dependency (see project CLAUDE.md: "prefer no new deps").
 */

/** Parse CSV text into records keyed by the header row. */
export function parseCsv(
  text: string,
  delimiter = ",",
): Record<string, string>[] {
  const rows = parseRows(text, delimiter);
  if (rows.length === 0) return [];

  const header = rows[0];
  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip the trailing empty row a final newline produces.
    if (row.length === 1 && row[0] === "") continue;

    const record: Record<string, string> = {};

    for (let c = 0; c < header.length; c++) {
      record[header[c]] = row[c] ?? "";
    }

    records.push(record);
  }

  return records;
}

/** Split CSV text into rows of raw string cells, honouring quoted fields. */
function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // Escaped quote.
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Consume \r\n as a single break.
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Flush the last field/row when the file has no trailing newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
