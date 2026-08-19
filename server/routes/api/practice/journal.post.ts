import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import { isMarketTicker } from "../../../utils/markets";

type JournalInput = {
  ticker?: string;
  entryType?: "note" | "entry" | "exit";
  note?: string;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<JournalInput>(event);
  const ticker = body?.ticker?.trim().toUpperCase() ?? "";
  const note = body?.note?.trim() ?? "";

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (
    !isMarketTicker(ticker) ||
    !["note", "entry", "exit"].includes(body?.entryType ?? "") ||
    note.length < 1 ||
    note.length > 1000
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose a market, entry type, and a note up to 1,000 characters.",
    });
  }

  const entries = await sql`
    INSERT INTO practice_journal_entries (user_id, ticker, entry_type, note)
    VALUES (${userId}, ${ticker}, ${body.entryType!}, ${note})
    RETURNING id, ticker, entry_type, note, created_at
  `;

  const entry = entries[0];

  return {
    id: Number(entry.id),
    ticker: entry.ticker,
    entryType: entry.entry_type,
    note: entry.note,
    createdAt: entry.created_at,
  };
});