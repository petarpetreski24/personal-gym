import { useState } from 'react';
import { useData } from '../store.tsx';
import { db, getEx } from '../db.ts';
import { DAYS, DAY_INFO, SLOTS } from '../seed/program.ts';
import { fmtDay } from '../util.ts';
import { finished, variantForWeek, weekNumber, weekRange, workingSets } from '../engine.ts';
import { LETTERS, autoVariant, plannedVariant, rotatingSlots } from '../rotation.ts';

export default function Program() {
  const { settings, sessions, rotation } = useData();
  const cur = weekNumber(new Date(), settings.blockStart);
  const first = Math.max(cur, 1);
  const [week, setWeek] = useState(first);
  const { start, end } = weekRange(week, settings.blockStart);

  const choose = (slotId: string, auto: string, v: string) => {
    const id = `${week}:${slotId}`;
    if (v === auto) db.rotation.delete(id);
    else db.rotation.put({ id, weekNumber: week, slotId, variant: v as 'A' | 'B' | 'C' });
  };

  /* what was actually logged, by week */
  const logged = finished(sessions).filter((s) => s.weekNumber <= cur);
  const histWeeks = [...new Set(logged.map((s) => s.weekNumber))].sort((a, b) => b - a);
  const doneVariant = (w: number, slotId: string) => {
    const slot = SLOTS.find((s) => s.id === slotId)!;
    const ids = new Set(logged.filter((s) => s.weekNumber === w).flatMap((s) => s.exercises.filter((e) => workingSets(e.sets).length).map((e) => e.exerciseId)));
    return LETTERS.filter((l) => ids.has(slot.variants![l]));
  };
  const weekLabel = (w: number) => (w >= 1 ? `Week ${w}` : 'Pre-block');

  return (
    <>
      <div className="card">
        <div className="between">
          <button className="btn" disabled={week <= first} onClick={() => setWeek(week - 1)}>‹</button>
          <div className="center">
            <b>{weekLabel(week)}{week === cur ? ' · this week' : ''}</b>
            <div className="muted small">{fmtDay(start)} – {fmtDay(end)} · variant {variantForWeek(week)}</div>
          </div>
          <button className="btn" disabled={week >= first + 8} onClick={() => setWeek(week + 1)}>›</button>
        </div>
      </div>

      {DAYS.map((d) => {
        const slots = rotatingSlots().filter((s) => s.dayId === d.id);
        return (
          <div key={d.id} className="card">
            <div className="between"><h3>{d.name}</h3><span className="muted small">{DAY_INFO[d.id].when} · ~{DAY_INFO[d.id].mins} min</span></div>
            {SLOTS.filter((s) => s.dayId === d.id).map((s) => {
              if (s.kind === 'fixed') {
                return (
                  <div key={s.id} className="between small prow">
                    <span>{getEx(s.exerciseId!).name} <span className="chip tiny">Fixed</span></span>
                    <span className="muted nowrap">{s.sets}×{s.repMin}–{s.repMax}</span>
                  </div>
                );
              }
              const auto = autoVariant(s, week, settings).variant;
              const p = plannedVariant(s, week, settings, rotation);
              return (
                <div key={s.id} className="prow">
                  <div className="between small">
                    <span className="muted">{s.label}{s.superset && <span className="chip tiny">SS</span>}</span>
                    <span className="muted nowrap">{s.sets}×{s.repMin}–{s.repMax}</span>
                  </div>
                  <select className="full" value={p.variant} onChange={(e) => choose(s.id, auto, e.target.value)}>
                    {LETTERS.map((l) => <option key={l} value={l}>{l}{l === auto ? ' (plan)' : ''}: {getEx(s.variants![l]).name}</option>)}
                  </select>
                </div>
              );
            })}
            {slots.length === 0 && null}
          </div>
        );
      })}

      <details className="card">
        <summary><b>Rotation calendar</b></summary>
        <p className="muted small">A → B → C, repeating. Your manual choices are applied.</p>
        {Array.from({ length: 6 }, (_, i) => first + i).map((w) => {
          const r = weekRange(w, settings.blockStart);
          return (
            <details key={w} className="cal" open={w === first}>
              <summary>{weekLabel(w)} · {fmtDay(r.start)} – {fmtDay(r.end)} <span className="chip tiny">{variantForWeek(w)}</span></summary>
              {rotatingSlots(true).map((s) => {
                const p = plannedVariant(s, w, settings, rotation);
                return <div key={s.id} className="between small prow"><span className="muted">{s.label}</span><span>{getEx(p.exerciseId).name}{p.manual && ' ✎'}</span></div>;
              })}
            </details>
          );
        })}
      </details>

      <details className="card">
        <summary><b>Rotation history</b></summary>
        {histWeeks.length === 0 && <p className="muted small">Import a Hevy export to see what you actually did each week.</p>}
        {histWeeks.map((w, i) => (
          <details key={w} className="cal" open={i === 0}>
            <summary>{weekLabel(w)} · {fmtDay(weekRange(w, settings.blockStart).start)}</summary>
            {rotatingSlots(true).map((s) => {
              const done = doneVariant(w, s.id);
              const plan = plannedVariant(s, w, settings, rotation).variant;
              return (
                <div key={s.id} className="between small prow">
                  <span className="muted">{s.label}</span>
                  <span className="right">
                    {done.length ? done.map((l) => getEx(s.variants![l]).name).join(', ') : '—'}
                    {done.length > 0 && !done.includes(plan) && <span className="chip warn tiny">plan {plan}</span>}
                  </span>
                </div>
              );
            })}
          </details>
        ))}
      </details>
    </>
  );
}
