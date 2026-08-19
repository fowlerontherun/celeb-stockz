import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type HistoryPoint = {
  capturedAt: string;
  price: number;
};

export function PriceChart({
  change,
  ticker,
  history,
}: {
  price: number;
  change: number;
  ticker: string;
  history?: HistoryPoint[];
}) {
  const data = (history ?? []).map((point, index) => ({
    point: index,
    price: point.price,
  }));
  const color = change >= 0 ? "#62e7b6" : "#ff9ca5";

  if (data.length < 2) {
    return (
      <div className="grid h-16 w-full place-items-center rounded-lg border border-dashed border-white/10 text-[10px] font-bold text-[#9f90ac]">
        Snapshot history building
      </div>
    );
  }

  return (
    <div className="h-16 w-full" aria-label={`${ticker} saved price history chart`}>
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
            formatter={(value: number) => [`${value.toFixed(2)} STKZ`, "Saved snapshot"]}
            labelFormatter={() => "Recorded market price"}
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