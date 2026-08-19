import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../../utils/db";

type JournalRow = {
  id: string;
  ticker: string;
  entry_type: "note" | "entry" | "exit";
  note: string;
  created_at: string;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const entries = await sql<JournalRow[]>`
    SELECT id, ticker, entry_type, note, created_at
    FROM practice_journal_entries
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 30
  `;

  return {
    entries: entries.map((entry) => ({
      id: Number(entry.id),
      ticker: entry.ticker,
      entryType: entry.entry_type,
      note: entry.note,
      createdAt: entry.created_at,
    })),
  };
});