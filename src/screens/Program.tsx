import { useData } from '../store.tsx';
import { getEx } from '../db.ts';
import { DAYS, DAY_INFO, SLOTS } from '../seed/program.ts';
import { fmtDay } from '../util.ts';
import { variantForWeek, weekNumber, weekRange } from '../engine.ts';

export default function Program() {
  const { settings } = useData();
  const week = weekNumber(new Date(), settings.blockStart);
  const cur = variantForWeek(week);
  const rotating = SLOTS.filter((s) => s.kind === 'rotating');
  const dates = (v: number) => { const { start } = weekRange(week + v, settings.blockStart); return fmtDay(start); };
  // next weeks that use each letter, starting from this week
  const nextWeekFor = (letter: string) => { for (let w = Math.max(week, 1); w < Math.max(week, 1) + 3; w++) if (variantForWeek(w) === letter) return w; return 1; };

  return (
    <>
      {DAYS.map((d) => (
        <div key={d.id} className="card">
          <div className="between"><h3>{d.name}</h3><span className="muted small">{DAY_INFO[d.id].when} · ~{DAY_INFO[d.id].mins} min</span></div>
          {SLOTS.filter((s) => s.dayId === d.id).map((s) => (
            <div key={s.id} className="between small prow">
              <span>{s.id} · {s.kind === 'fixed' ? getEx(s.exerciseId!).name : s.label}{s.superset && <span className="chip tiny">SS</span>}</span>
              <span className="muted nowrap">{s.sets}×{s.repMin}–{s.repMax} · RPE {s.rpeTarget[0]}–{s.rpeTarget[1]}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="card">
        <h3>Rotation calendar</h3>
        <p className="muted small">Week {week > 0 ? week : 'pre-block'} → variant {cur}. Weeks repeat A → B → C.</p>
        <div className="scroll">
          <table>
            <thead><tr><th>Slot</th>{(['A', 'B', 'C'] as const).map((v) => <th key={v} className={v === cur ? 'hl' : ''}>{v}<div className="muted small">wk {nextWeekFor(v)} · {dates(nextWeekFor(v) - week)}</div></th>)}</tr></thead>
            <tbody>
              {rotating.map((s) => (
                <tr key={s.id}><td>{s.id}</td>{(['A', 'B', 'C'] as const).map((v) => <td key={v} className={v === cur ? 'hl' : ''}>{getEx(s.variants![v]).name}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card small rules">
        <h3>Rules</h3>
        <ul>
          <li>Compounds are fixed; isolations rotate weekly (A → B → C).</li>
          <li>Compound sets stop 1–2 reps short (RPE 8–9); lower-body compounds 2–3 short (RPE 7–8); isolations 0–1 short.</li>
          <li>Hit the top of the rep range on every set → add one step and reset to the bottom. Lower-body lifts also need RPE ≤ 7 (or two sessions in a row).</li>
          <li>Every set 3+ reps over the range → jump two steps. Below the range twice at the same load → −10%.</li>
          <li>Leg press stays at 85 kg. Legs are maintenance; thigh definition comes from diet.</li>
          <li>Miss a day? The next session is simply the next day in order. Upper C is a bonus, never owed.</li>
          <li>Week 5+: a 4th set on Bench and Lat Pulldown is offered if sessions average ≤ 60 min.</li>
        </ul>
      </div>
    </>
  );
}
