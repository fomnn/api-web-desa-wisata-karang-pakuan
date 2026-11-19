import { sql, type AnyColumn, type SQL } from "drizzle-orm";

export function likeContains(column: AnyColumn, value: string): SQL {
  const escaped = value.replace(/[\\%_]/g, (char) => `\\${char}`);
  return sql`${column} LIKE ${`%${escaped}%`} ESCAPE '\\'`;
}
