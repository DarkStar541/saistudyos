import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DayDatum = {
  key: string;
  label: string;
  focusMinutes: number;
  completedTasks: number;
  plannedTasks: number;
};

export function InsightsCharts({ data, period }: { data: DayDatum[]; period: 7 | 30 | 90 }) {
  const interval = period === 90 ? 13 : period === 30 ? 4 : 0;
  const margin = { top: 8, right: 8, left: -18, bottom: 0 };
  const tick = { fill: "var(--muted-foreground)", fontSize: 11 };
  const tooltip = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold">Daily focus</h2>
        <p className="mt-1 text-sm text-muted-foreground">Minutes spent in recorded focus sessions.</p>
        <div className="mt-5 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={margin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={interval} />
              <YAxis tick={tick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltip} />
              <Bar dataKey="focusMinutes" name="Focus minutes" fill="var(--primary)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold">Completed work</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tasks marked complete on each day.</p>
        <div className="mt-5 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={margin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={interval} />
              <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltip} />
              <Bar dataKey="completedTasks" name="Completed tasks" fill="var(--primary)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
