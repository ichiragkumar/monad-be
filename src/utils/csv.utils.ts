import { parse } from "csv-parse/sync";

export interface CSVRow {
  address: string;
  amount?: string;
  [key: string]: string | undefined;
}

/**
 * Parse CSV file buffer to array of rows
 */
export const parseWhitelistCSV = (buffer: Buffer): CSVRow[] => {
  try {
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    return records.map((row: any) => ({
      address: row.address || row.Address || row.wallet,
      amount: row.amount || row.Amount || undefined,
    }));
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

