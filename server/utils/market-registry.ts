import { sql } from "./db";
import { getMarketMetadata } from "./market-metadata";
import { celebrityMarkets } from "./markets";

export async function syncMarketRegistry() {
  await Promise.all(
    celebrityMarkets.map(async (market) => {
      const metadata = getMarketMetadata(market);

      await sql`
        INSERT INTO celebrity_markets (
          ticker, display_name, category, is_living, is_tradeable,
          wikipedia_title, source_category, region, reviewed_at, updated_at
        )
        VALUES (
          ${market.ticker},
          ${market.name},
          ${market.category},
          ${metadata.isLiving},
          ${metadata.isTradeable},
          ${metadata.wikipediaTitle},
          ${metadata.sourceCategory},
          ${metadata.region},
          ${metadata.reviewedAt},
          now()
        )
        ON CONFLICT (ticker) DO UPDATE
        SET
          display_name = EXCLUDED.display_name,
          category = EXCLUDED.category,
          is_living = EXCLUDED.is_living,
          is_tradeable = EXCLUDED.is_tradeable,
          wikipedia_title = EXCLUDED.wikipedia_title,
          source_category = EXCLUDED.source_category,
          region = EXCLUDED.region,
          reviewed_at = EXCLUDED.reviewed_at,
          updated_at = now()
      `;
    }),
  );
}