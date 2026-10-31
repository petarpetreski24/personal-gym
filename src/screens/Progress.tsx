import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../store.tsx';
import { getEx } from '../db.ts';
import { MUSCLE_TARGETS } from '../seed/program.ts';
import { finished, sessionMinutes, weekNumber, weeklyVolume } from '../engine.ts';
import { fmtNum } from '../util.ts';
import { SeriesChart, seriesFor } from './Charts.tsx';

const LIFTS = ['bench-press-barbell', 'lat-pulldown', 'seated-cable-row-v', 'overhead-press-barbell', 'incline-db-press', 'one-arm-db-row', 'rdl-barbell', 'chest-press-machine'];

export default function Progress() {
  const { sessions, settings } = useData();
  const cur = weekNumber(new Date(), settings.blockStart);
  const weeks = Array.from({ length: 8 }, (_, i) => cur - 7 + i);
  const vols = weeks.map((w) => weeklyVolume(sessions, w, getEx));
  const mins = weeks.map((w) => {
    const ss = finished(sessions).filter((s) => s.weekNumber === w);
    return { d: `W${w}`, v: ss.length ? Math.round(ss.reduce((a, s) => a + sessionMinutes(s), 0) / ss.length) : 0 };
  });

  return (
    <>
      {LIFTS.map((id) => (
        <div key={id} className="card"><h3>{getEx(id).name}</h3><SeriesChart data={seriesFor(id, sessions)} height={140} /></div>
      ))}
      <div className="card">
        <h3>Leg press (cap 85 kg)</h3>
        <SeriesChart data={seriesFor('leg-press-horizontal', sessions, 'weight')} cap={85} height={140} />
      </div>
      <div className="card">
        <h3>Hard sets per week</h3>
        <div className="scroll">
          <table className="vol">
            <thead><tr><th></th>{weeks.map((w) => <th key={w}>{w}</th>)}<th>goal</th></tr></thead>
            <tbody>
              {MUSCLE_TARGETS.map((t) => (
                <tr key={t.muscle}>
                  <td>{t.label}</td>
                  {vols.map((v, i) => { const n = v[t.muscle] ?? 0; return <td key={i} className={n >= t.min ? 'okc' : n > 0 ? 'warnc' : ''}>{n ? fmtNum(n) : '·'}</td>; })}
                  <td className="muted">{t.min}{t.max ? `–${t.max}` : '+'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>Avg session minutes</h3>
        <div style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mins} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="d" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)' }} />
              <Bar dataKey="v" fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
