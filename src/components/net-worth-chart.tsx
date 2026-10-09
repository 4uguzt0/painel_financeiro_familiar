"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/money";
import { monthShort } from "@/lib/dates";

type Point = { month: string; value: number };

function compact(cents: number) {
  const v = cents / 100;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function NetWorthChart({ data }: { data: Point[] }) {
  if (data.length < 2) {
    return (
      <div className="mt-4 grid h-28 place-items-center rounded-xl border border-dashed border-rule text-center text-sm text-ink-faint">
        O gráfico aparece a partir do segundo mês de uso.
      </div>
    );
  }
  const crossesYear = data[0].month.slice(0, 4) !== data[data.length - 1].month.slice(0, 4);

  return (
    <div className="mt-4 h-44" role="img" aria-label={`Evolução do patrimônio: de ${formatBRL(data[0].value)} para ${formatBRL(data[data.length - 1].value)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pine)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--pine)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--rule)" strokeDasharray="0" />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => monthShort(m, crossesYear && m.slice(5, 7) === "01")}
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickFormatter={compact}
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: "var(--ink-faint)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="rounded-lg border border-rule bg-sheet px-3 py-2 text-xs shadow-sm">
                  <p className="text-ink-soft">fim de {monthShort(p.month, true)}</p>
                  <p className="font-semibold text-ink">{formatBRL(p.value)}</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--pine)"
            strokeWidth={2}
            fill="url(#nw)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--pine)", stroke: "var(--sheet)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
