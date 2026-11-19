"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TrendPoint {
  date: string;
  completed: number;
  created: number;
}

interface StatusPoint {
  name: string;
  value: number;
  color: string;
}

export function TaskActivityChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
          barGap={4}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#EAECF0"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#737987" }}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#737987" }}
          />
          <Tooltip
            cursor={{ fill: "#F7F8FA" }}
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #EAECF0",
              borderRadius: "6px",
              fontSize: "12px",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
            }}
          />
          <Bar
            dataKey="created"
            name="Created"
            fill="#C7C4F8"
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            dataKey="completed"
            name="Completed"
            fill="#635BDB"
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaskStatusDonut({ data }: { data: StatusPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative h-[165px] w-[165px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total > 0 ? data : [{ name: "Empty", value: 1, color: "#EAECF0" }]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={total > 0 ? 2 : 0}
              strokeWidth={0}
            >
              {(total > 0
                ? data
                : [{ name: "Empty", value: 1, color: "#EAECF0" }]
              ).map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #EAECF0",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-[#20232B]">{total}</span>
          <span className="text-[11px] text-[#737987]">Tasks</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {data.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div
              key={item.name}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[#4B5563]">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 font-medium text-[#20232B]">
                <span>{item.value}</span>
                <span className="text-[11px] text-[#9CA3AF] w-8 text-right">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
