import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bestE1rm, entriesFor, workingSets } from '../engine.ts';
import { fmtDate } from '../util.ts';
import type { Session } from '../types.ts';

const tick = { fill: 'var(--muted)', fontSize: 11 };

export function seriesFor(exerciseId: string, sessions: Session[], mode: 'e1rm' | 'weight' = 'e1rm') {
  return entriesFor(exerciseId, sessions).reverse().map(({ session, entry }) => ({
    d: fmtDate(session.startedAt),
    v: Math.round((mode === 'e1rm' ? bestE1rm(entry.sets) : (exerciseId === 'assisted-pull-up' ? Math.min : Math.max)(...workingSets(entry.sets).map((s) => s.weightKg ?? 0))) * 10) / 10,
  }));
}

export function SeriesChart({ data, cap, height = 160, unit = 'kg' }: { data: { d: string; v: number }[]; cap?: number; height?: number; unit?: string }) {
  if (data.length < 1) return <div className="muted small">No data yet</div>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -18, right: 8, top: 6 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="d" tick={tick} />
          <YAxis tick={tick} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)' }} formatter={(v) => [`${v} ${unit}`, '']} />
          {cap != null && <ReferenceLine y={cap} stroke="var(--warn)" strokeDasharray="4 4" label={{ value: `cap ${cap}`, fill: 'var(--warn)', fontSize: 11 }} />}
          <Line type="linear" dataKey="v" stroke="var(--accent)" strokeWidth={1} dot={{ r: 2, fill: 'var(--accent)' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
