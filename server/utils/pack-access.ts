import { sql } from "./db";

type PackRow = {
  pack_id: number;
  name: string;
};

export async function getLockedPacksForMarket(userId: string, ticker: string) {
  const rows = await sql<PackRow[]>`
    SELECT members.pack_id, packs.name
    FROM celebrity_pack_members AS members
    JOIN celebrity_packs AS packs ON packs.id = members.pack_id
    LEFT JOIN user_pack_unlocks AS unlocks
      ON unlocks.pack_id = members.pack_id
      AND unlocks.user_id = ${userId}
    WHERE members.ticker = ${ticker}
      AND unlocks.pack_id IS NULL
  `;

  return rows.map((row) => ({ id: Number(row.pack_id), name: row.name }));
}

export async function canTradeMarket(userId: string, ticker: string) {
  return (await getLockedPacksForMarket(userId, ticker)).length === 0;
}