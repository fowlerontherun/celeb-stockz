import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export function PriceChart({
  price,
  change,
  ticker,
}: {
  price: number;
  change: number;
  ticker: string;
}) {
  const data = useMemo(() => {
    const direction = change >= 0 ? 1 : -1;
    return Array.from({ length: 14 }, (_, index) => {
      const progress = index / 13;
      const variation = Math.sin(index * 1.73) * price * 0.018;
      const start = price / (1 + (change / 100) * direction);
      return {
        point: index,
        price: Number(
          (start + (price - start) * progress + variation).toFixed(2),
        ),
      };
    });
  }, [change, price]);

  const color = change >= 0 ? "#62e7b6" : "#ff9ca5";

  return (
    <div className="h-16 w-full" aria-label={`${ticker} modeled 7-day price chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={`chart-${ticker}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.34} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "#211230",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 10,
              color: "#fff8f2",
              fontSize: 11,
            }}
            formatter={(value: number) => [`${value.toFixed(2)} STKZ`, "Price"]}
            labelFormatter={() => "Modeled price"}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            fill={`url(#chart-${ticker})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}