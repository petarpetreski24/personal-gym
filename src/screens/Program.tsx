import { useState, type ReactNode } from 'react';
import { useData } from '../store.tsx';
import { db, getEx } from '../db.ts';
import { DAYS, DAY_INFO, SLOTS } from '../seed/program.ts';
import { fmtDate, fmtDay, fmtNum, fmtSets, mmss } from '../util.ts';
import { dayOfSession, entriesFor, finished, reviewExercise, targetFor, variantForWeek, weekNumber, weekRange, workingSets } from '../engine.ts';
import { LETTERS, autoVariant, plannedVariant, rotatingSlots } from '../rotation.ts';
import type { Slot } from '../types.ts';

const restSeconds = (slot: Slot, exerciseId: string) => (slot.superset ? 90 : getEx(exerciseId).type === 'compound' ? 150 : 75);

export default function Program() {
  const { settings, sessions, rotation } = useData();
  const cur = weekNumber(new Date(), settings.blockStart);
  const first = Math.max(cur, 1);
  const logged = finished(sessions).filter((s) => s.weekNumber <= cur);
  // earlier weeks that have data, then this week and the coming ones
  const weeks = [...new Set([...logged.map((s) => s.weekNumber), ...Array.from({ length: 9 }, (_, i) => first + i)])].sort((a, b) => a - b);
  const [week, setWeek] = useState(first);
  const idx = weeks.indexOf(week);
  const past = week < cur;
  const { start, end } = weekRange(week, settings.blockStart);
  const inWeek = logged.filter((s) => s.weekNumber === week);
  const weekLabel = (w: number) => (w >= 1 ? `Week ${w}` : 'Pre-block');

  const lock = (slotId: string, variant: 'A' | 'B' | 'C') => db.rotation.put({ id: `${week}:${slotId}`, weekNumber: week, slotId, variant });
  const unlock = (slotId: string) => db.rotation.delete(`${week}:${slotId}`);

  /* what was actually logged, by week */
  const histWeeks = [...new Set(logged.map((s) => s.weekNumber))].sort((a, b) => b - a);
  const doneVariant = (w: number, slot: Slot) => {
    const ids = new Set(logged.filter((s) => s.weekNumber === w).flatMap((s) => s.exercises.filter((e) => workingSets(e.sets).length).map((e) => e.exerciseId)));
    return LETTERS.filter((l) => ids.has(slot.variants![l]));
  };

  return (
    <>
      <div className="card">
        <div className="between">
          <button className="btn" aria-label="Previous week" disabled={idx <= 0} onClick={() => setWeek(weeks[idx - 1])}>‹</button>
          <div className="center">
            <b>{weekLabel(week)}{week === cur ? ' · this week' : ''}</b>
            <div className="muted small">{fmtDay(start)} – {fmtDay(end)} · variant {variantForWeek(week)}</div>
          </div>
          <button className="btn" aria-label="Next week" disabled={idx >= weeks.length - 1} onClick={() => setWeek(weeks[idx + 1])}>›</button>
        </div>
        {week !== first && <button className="btn block thisweek" onClick={() => setWeek(first)}>Back to this week</button>}
      </div>

      {DAYS.map((d) => {
        const slots = SLOTS.filter((s) => s.dayId === d.id);
        const done = inWeek.find((s) => dayOfSession(s) === d.id);
        const rotating = slots.filter((s) => s.kind === 'rotating');
        const locked = rotating.filter((s) => plannedVariant(s, week, settings, rotation).locked).length;
        return (
          <details key={`${week}:${d.id}`} className="card" open={past ? !!done : !done && !d.optional}>
            <summary className="daysum">
              <span><b>{d.name}</b><div className="muted small">{DAY_INFO[d.id].when} · ~{DAY_INFO[d.id].mins} min · {slots.reduce((a, s) => a + s.sets, 0)} sets</div></span>
              {done ? <span className="chip ok">Done {fmtDay(new Date(done.startedAt))}</span>
                : !past && <span className="chip">{locked}/{rotating.length} locked</span>}
            </summary>
            {slots.map((s) => (
              <div key={s.id} className={`slot ${s.superset ? 'ss' : ''}`}>
                <div className="between small">
                  <span className="muted">{s.label}{s.superset && ` · superset ${s.superset}`}</span>
                  <span className="muted nowrap">{s.kind === 'fixed' ? 'Fixed' : 'Rotates'}</span>
                </div>
                {s.kind === 'fixed'
                  ? <ExerciseInfo slot={s} exerciseId={s.exerciseId!} week={week} />
                  : <RotatingSlot slot={s} week={week} past={past} lock={lock} unlock={unlock} done={doneVariant(week, s)} />}
              </div>
            ))}
          </details>
        );
      })}

      <details className="card">
        <summary><b>Rotation calendar</b></summary>
        <p className="muted small">A → B → C, repeating. Exercises you locked show 🔒.</p>
        {Array.from({ length: 6 }, (_, i) => first + i).map((w) => {
          const r = weekRange(w, settings.blockStart);
          return (
            <details key={w} className="cal" open={w === first}>
              <summary>{weekLabel(w)} · {fmtDay(r.start)} – {fmtDay(r.end)} <span className="chip tiny">{variantForWeek(w)}</span></summary>
              {rotatingSlots(true).map((s) => {
                const p = plannedVariant(s, w, settings, rotation);
                return <div key={s.id} className="between small prow"><span className="muted">{s.label}</span><span className="right">{getEx(p.exerciseId).name}{p.locked && ' 🔒'}</span></div>;
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
              const done = doneVariant(w, s);
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

function RotatingSlot({ slot, week, past, lock, unlock, done }: {
  slot: Slot; week: number; past: boolean; done: ('A' | 'B' | 'C')[];
  lock: (slotId: string, v: 'A' | 'B' | 'C') => void; unlock: (slotId: string) => void;
}) {
  const { settings, rotation } = useData();
  const auto = autoVariant(slot, week, settings).variant;
  const p = plannedVariant(slot, week, settings, rotation);

  if (past) {
    const shown = done.length ? done : [p.variant];
    return <>{shown.map((l) => <ExerciseInfo key={l} slot={slot} exerciseId={slot.variants![l]} week={week} letter={l} />)}</>;
  }
  if (p.locked) {
    return (
      <div className="opt lockedopt">
        <ExerciseInfo slot={slot} exerciseId={p.exerciseId} week={week} letter={p.variant}
          badge={<span className="chip ok">🔒 Locked</span>} />
        <button className="btn block" onClick={() => unlock(slot.id)}>Unlock</button>
      </div>
    );
  }
  return (
    <>
      {LETTERS.map((l) => {
        const id = slot.variants![l];
        const eq = getEx(id).equipment;
        const missing = !!eq && settings.equip.unavailable.includes(eq);
        return (
          <div key={l} className={`opt ${l === auto ? 'planned' : ''}`}>
            <ExerciseInfo slot={slot} exerciseId={id} week={week} letter={l}
              badge={l === auto ? <span className="chip">Planned</span> : missing ? <span className="chip warn">Unavailable</span> : undefined} />
            <button className={`btn block ${l === auto ? 'primary' : ''}`} disabled={missing} onClick={() => lock(slot.id, l)}>🔒 Lock for this week</button>
          </div>
        );
      })}
    </>
  );
}

function ExerciseInfo({ slot, exerciseId, week, letter, badge }: { slot: Slot; exerciseId: string; week: number; letter?: string; badge?: ReactNode }) {
  const { sessions, settings, notes } = useData();
  const ex = getEx(exerciseId);
  const past = week < weekNumber(new Date(), settings.blockStart);
  const before = sessions.filter((s) => s.weekNumber < week);
  const t = targetFor(ex, slot, before, settings.equip);
  const [prev, older] = entriesFor(exerciseId, before);
  const thisWeek = entriesFor(exerciseId, sessions.filter((s) => s.weekNumber === week))[0];
  const review = prev && reviewExercise(prev.entry.sets, older?.entry.sets, ex, slot);
  const note = notes.find((n) => n.exerciseId === exerciseId)?.text;
  const load = !t.weightKg && t.weightKg !== null ? 'BW' : `${fmtNum(t.weightKg)} kg`;
  const hevy = ex.hevyNames[0];

  return (
    <div className="einfo">
      <div className="between">
        <b>{letter && <span className="muted">{letter} · </span>}{ex.name}</b>
        {badge}
      </div>
      <div className="muted small">
        {slot.sets} sets × {slot.repMin}–{slot.repMax} · RPE {slot.rpeTarget[0]}–{slot.rpeTarget[1]} · rest {mmss(restSeconds(slot, exerciseId))}{slot.superset && ' after both'}
        {ex.perSide && ' · per side'}{ex.id === 'assisted-pull-up' && ' · weight = assistance'}
      </div>
      {(!past || prev) && (
        <>
          <div className="kv">
            <span className="muted">Suggested</span>
            <div>{t.weightKg != null ? <><b>{load} × {t.repGoals.join('/')}</b><div className="muted small">{t.reason}</div></> : t.reason}</div>
          </div>
          <div className="kv">
            <span className="muted">Previous</span>
            <div>
              {prev ? <>{fmtDate(prev.session.startedAt)}, {prev.session.title} · {fmtSets(prev.entry.sets)} {review && <span className={`chip tiny ${review.tone}`}>{review.status}</span>}</> : <span className="muted">Not done yet</span>}
              {prev?.entry.note && <div className="muted small">{prev.entry.note}</div>}
            </div>
          </div>
        </>
      )}
      {(thisWeek || past) && <div className="kv"><span className="muted">Logged</span><div>{thisWeek ? `${fmtDate(thisWeek.session.startedAt)} · ${fmtSets(thisWeek.entry.sets)}` : <span className="muted">Not logged</span>}</div></div>}
      {note && <div className="kv"><span className="muted">My note</span><div>{note}</div></div>}
      <details className="how">
        <summary>How to do it</summary>
        <p className="small">{ex.description}</p>
        {ex.cues.length > 0 && <ul className="small">{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>}
        <p className="muted small">{hevy ? `In Hevy: ${hevy}` : `Not mapped to a Hevy exercise. Log it as a custom exercise named exactly "${ex.name}" so the import recognises it.`}</p>
      </details>
    </div>
  );
}
