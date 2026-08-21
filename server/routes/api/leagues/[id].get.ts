import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getLatestVerifiedPrices } from "../../../utils/market-snapshots";

type MemberRow = {
  user_id: string;
  role: string;
  joined_at: string;
  display_name: string | null;
  nickname: string | null;
  balance_stkz: string;
  ticker: string | null;
  quantity: string | null;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const leagueId = getRouterParam(event, "id");

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (!leagueId) {
    throw createError({ statusCode: 400, statusMessage: "Invalid league ID." });
  }

  const leagueRows = await sql`
    SELECT l.id, l.name, l.description, l.owner_id, lm.role
    FROM leagues l
    JOIN league_members lm ON lm.league_id = l.id AND lm.user_id = ${userId}
    WHERE l.id = ${leagueId}
  `;

  const league = leagueRows[0];
  if (!league) {
    throw createError({ statusCode: 404, statusMessage: "League not found or you are not a member." });
  }

  const [memberRows, prices] = await Promise.all([
    sql<MemberRow[]>`
      SELECT
        lm.user_id,
        lm.role,
        lm.joined_at,
        p.display_name,
        p.nickname,
        w.balance_stkz,
        pos.ticker,
        pos.quantity
      FROM league_members lm
      LEFT JOIN user_profiles p ON p.user_id = lm.user_id
      LEFT JOIN user_wallets w ON w.user_id = lm.user_id
      LEFT JOIN user_positions pos ON pos.user_id = lm.user_id AND pos.quantity > 0
      WHERE lm.league_id = ${leagueId}
    `,
    getLatestVerifiedPrices(),
  ]);

  const traders = new Map<string, {
    traderId: string;
    name: string;
    nickname: string | null;
    role: string;
    joinedAt: string;
    netWorth: number;
    isCurrentUser: boolean;
  }>();

  for (const row of memberRows) {
    const defaultName = row.display_name?.trim() || `Trader ${row.user_id.slice(-4).toUpperCase()}`;
    const nick = row.nickname?.trim() || null;
    const finalName = nick || defaultName;

    const existing = traders.get(row.user_id) ?? {
      traderId: row.user_id,
      name: finalName,
      nickname: nick,
      role: row.role,
      joinedAt: row.joined_at,
      netWorth: Number(row.balance_stkz ?? 10000),
      isCurrentUser: row.user_id === userId,
    };

    if (row.ticker && row.quantity) {
      existing.netWorth += Number(row.quantity) * (prices.get(row.ticker) ?? 0);
    }

    traders.set(row.user_id, existing);
  }

  const leaderboard = Array.from(traders.values())
    .map((trader) => ({
      ...trader,
      netWorth: Number(trader.netWorth.toFixed(2)),
      profitLoss: Number((trader.netWorth - 10000).toFixed(2)),
    }))
    .sort((a, b) => b.netWorth - a.netWorth)
    .map((trader, index) => ({ ...trader, rank: index + 1 }));

  return {
    league: {
      id: league.id,
      name: league.name,
      description: league.description,
      ownerId: league.owner_id,
      myRole: league.role,
      isOwner: league.owner_id === userId,
      leaderboard,
    },
  };
});