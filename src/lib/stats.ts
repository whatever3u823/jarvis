import { db } from "./db";

export interface LibraryStats {
  volumes: number;
  pages: number;
  passages: number;
}

export async function libraryStats(): Promise<LibraryStats> {
  const { rows } = await db().query(
    `select count(*)::int as volumes, coalesce(sum(page_count), 0)::int as pages,
            coalesce(sum(chunk_count), 0)::int as passages
     from documents`,
  );
  return rows[0];
}
