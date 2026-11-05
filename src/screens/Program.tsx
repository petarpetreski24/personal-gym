import { useState } from 'react';
import { useData } from '../store.tsx';
import { getEx } from '../db.ts';
import { DAYS, DAY_INFO, PLAN_FROM, SLOTS } from '../seed/program.ts';
import { fmtDate, fmtDay, fmtNum, fmtSets, mmss } from '../util.ts';
import { dayOfSession, doseFor, entriesFor, finished, navigableWeeks, offPlanEntries, onSlotDay, reviewExercise, sessionName, targetFor, variantForWeek, weekNumber, weekRange, workingSets } from '../engine.ts';
import { LETTERS, plannedVariant, rotatingSlots } from '../rotation.ts';
import type { Slot } from '../types.ts';

const CALENDAR_WEEKS = 8;

const restSeconds = (slot: Slot, exerciseId: string) => (slot.superset ? 90 : getEx(exerciseId).type === 'compound' ? 150 : 75);

export default function Program() {
  const { settings, sessions } = useData();
  const cur = weekNumber(new Date(), settings.blockStart);
  const first = Math.max(cur, 1);
  const logged = finished(sessions).filter((s) => s.weekNumber <= cur);
  const weeks = navigableWeeks(sessions, cur, 8);
  const [week, setWeek] = useState(first);
  const idx = weeks.indexOf(week);
  const past = week < cur;
  const { start, end } = weekRange(week, settings.blockStart);
  const inWeek = logged.filter((s) => s.weekNumber === week);
  const weekLabel = (w: number) => (w >= 1 ? `Week ${w}` : 'Pre-block');

  const onPlan = (w: number) => weekRange(w, settings.blockStart).start >= PLAN_FROM;

  /* what was actually logged, by week */
  const histWeeks = [...new Set(logged.map((s) => s.weekNumber))].sort((a, b) => b - a);
  const doneVariant = (w: number, slot: Slot) => {
    const ids = new Set(logged.filter((s) => s.weekNumber === w && onSlotDay(s, slot)).flatMap((s) => s.exercises.filter((e) => workingSets(e.sets).length).map((e) => e.exerciseId)));
    return LETTERS.filter((l) => ids.has(slot.variants![l]));
  };
  /** A slot's exercises in the shown week: what was logged, else the plan. Days trained on the old rotation show only what was logged. */
  const exercisesFor = (slot: Slot) => {
    if (slot.exerciseId) return [slot.exerciseId];
    const did = week <= cur ? doneVariant(week, slot) : [];
    if (did.length) return did.map((l) => slot.variants![l]);
    const oldDay = inWeek.some((s) => dayOfSession(s) === slot.dayId && new Date(s.startedAt) < PLAN_FROM);
    return oldDay || (past && !onPlan(week)) ? [] : [plannedVariant(slot, week, settings).exerciseId];
  };

  return (
    <>
      <div className="card weekhead">
        <div className="between">
          <button className="btn" aria-label="Previous week" disabled={idx <= 0} onClick={() => setWeek(weeks[idx - 1])}>&lt;</button>
          <div className="center">
            <b>{weekLabel(week)}{week === cur ? ' · this week' : ''}</b>
            <div className="muted small">{fmtDay(start)} – {fmtDay(end)} · week {variantForWeek(week)}</div>
          </div>
          <button className="btn" aria-label="Next week" disabled={idx >= weeks.length - 1} onClick={() => setWeek(weeks[idx + 1])}>&gt;</button>
        </div>
        {week !== first && <button className="btn block thisweek" onClick={() => setWeek(first)}>Back to this week</button>}
      </div>

      {DAYS.map((d) => {
        const slots = SLOTS.filter((s) => s.dayId === d.id);
        const done = inWeek.find((s) => dayOfSession(s) === d.id);
        const sets = slots.reduce((a, s) => a + doseFor(s, s.exerciseId ?? plannedVariant(s, week, settings).exerciseId).sets, 0);
        return (
          <details key={`${week}:${d.id}`} className="card" open={past ? !!done : !done && !d.optional}>
            <summary className="daysum">
              <b>{d.name}</b>
              <span>
                {DAY_INFO[d.id].when} · {DAY_INFO[d.id].mins} min · {sets} sets
                {done && <div className="muted">Done {fmtDay(new Date(done.startedAt))}</div>}
              </span>
            </summary>
            {slots.flatMap((s) => exercisesFor(s).map((id) => (
              <div key={`${s.id}:${id}`} className={`slot ${s.superset ? 'ss' : ''}`}>
                <ExerciseRow slot={s} exerciseId={id} week={week} />
              </div>
            )))}
            {done && offPlanEntries(done).length > 0 && (
              <div className="slot">
                <span className="muted small">Also logged, not in this day's plan</span>
                {offPlanEntries(done).map((e) => <div key={e.exerciseId} className="small">{getEx(e.exerciseId).name} · {fmtSets(e.sets)}</div>)}
              </div>
            )}
          </details>
        );
      })}

      <details className="card">
        <summary><b>Rotation calendar</b></summary>
        <p className="muted small">Week A and week B alternate.{!settings.equip.found.includes('nordic anchor') && ' Nordic curls join week B once you tick the anchor in Settings.'}</p>
        {Array.from({ length: CALENDAR_WEEKS }, (_, i) => first + i).map((w) => {
          const r = weekRange(w, settings.blockStart);
          return (
            <details key={w} className="cal">
              <summary>{weekLabel(w)} · {fmtDay(r.start)} – {fmtDay(r.end)} <span className="chip tiny">{variantForWeek(w)}</span></summary>
              {DAYS.map((d) => (
                <div key={d.id} className="calday">
                  <div className="small">{d.name}</div>
                  {rotatingSlots().filter((s) => s.dayId === d.id).map((s) => (
                    <div key={s.id} className="between small prow"><span className="muted">{s.label}</span><span className="right">{getEx(plannedVariant(s, w, settings).exerciseId).name}</span></div>
                  ))}
                </div>
              ))}
            </details>
          );
        })}
      </details>

      <details className="card">
        <summary><b>Rotation history</b></summary>
        {histWeeks.length === 0 && <p className="muted small">Import a Hevy export to see what you actually did each week.</p>}
        {histWeeks.map((w) => {
          const other = [...new Set(logged.filter((s) => s.weekNumber === w).flatMap((s) => offPlanEntries(s).map((e) => getEx(e.exerciseId).name)))];
          return (
            <details key={w} className="cal">
              <summary>{weekLabel(w)} · {fmtDay(weekRange(w, settings.blockStart).start)}</summary>
              {rotatingSlots().map((s) => {
                const done = doneVariant(w, s);
                const plan = plannedVariant(s, w, settings).variant;
                return (
                  <div key={s.id} className="between small prow">
                    <span className="muted">{s.label}</span>
                    <span className="right">
                      {done.length ? done.map((l) => getEx(s.variants![l]).name).join(', ') : '—'}
                      {onPlan(w) && done.length > 0 && !done.includes(plan) && <span className="chip warn tiny">plan {plan}</span>}
                    </span>
                  </div>
                );
              })}
              {other.length > 0 && <div className="between small prow"><span className="muted">Other</span><span className="right">{other.join(', ')}</span></div>}
            </details>
          );
        })}
      </details>
    </>
  );
}

function ExerciseName({ exerciseId, open, toggle, dim }: { exerciseId: string; open: boolean; toggle: () => void; dim?: boolean }) {
  return (
    <button className={`exname ${dim ? 'muted' : ''}`} aria-expanded={open} onClick={toggle}>
      <span className="mark" aria-hidden="true">[/]</span>
      <span className="nm">{getEx(exerciseId).name}</span>
      <span className="fold" aria-hidden="true">{open ? '[-]' : '[+]'}</span>
    </button>
  );
}

function ExerciseRow({ slot, exerciseId, week }: { slot: Slot; exerciseId: string; week: number }) {
  const { sessions, settings } = useData();
  const [open, setOpen] = useState(false);
  const notLogged = week < weekNumber(new Date(), settings.blockStart)
    && !entriesFor(exerciseId, sessions.filter((s) => s.weekNumber === week && onSlotDay(s, slot))).length;
  return (
    <>
      <ExerciseName exerciseId={exerciseId} open={open} toggle={() => setOpen(!open)} dim={notLogged} />
      {open && <ExerciseInfo slot={doseFor(slot, exerciseId)} exerciseId={exerciseId} week={week} />}
    </>
  );
}

function ExerciseInfo({ slot, exerciseId, week }: { slot: Slot; exerciseId: string; week: number }) {
  const { sessions, settings, notes } = useData();
  const ex = getEx(exerciseId);
  const past = week < weekNumber(new Date(), settings.blockStart);
  const before = sessions.filter((s) => s.weekNumber < week);
  const t = targetFor(ex, slot, before, settings.equip);
  // Previous shows the sessions the suggestion is built from; off-plan work appears on its own line
  const [prev, older] = entriesFor(exerciseId, before, { forTarget: true });
  const latest = entriesFor(exerciseId, before)[0];
  const alsoDone = latest && latest.session.id !== prev?.session.id ? latest : undefined;
  const thisWeek = entriesFor(exerciseId, sessions.filter((s) => s.weekNumber === week && onSlotDay(s, slot)))[0];
  const review = prev && reviewExercise(prev.entry.sets, older?.entry.sets, ex, slot);
  const note = notes.find((n) => n.exerciseId === exerciseId)?.text;
  const load = !t.weightKg && t.weightKg !== null ? 'BW' : `${fmtNum(t.weightKg)} kg`;
  const hevy = ex.hevyNames[0];

  return (
    <div className="einfo">
      <div className="muted small">
        {slot.label}{slot.superset && ` · superset ${slot.superset}`} · {slot.kind === 'fixed' ? 'Fixed' : `Rotates, week ${variantForWeek(week)}`}
      </div>
      <div className="muted small">
        {slot.sets} sets × {slot.repMin}–{slot.repMax} · RPE {slot.rpeTarget[0]}–{slot.rpeTarget[1]} · rest {mmss(restSeconds(slot, exerciseId))}{slot.superset && ' after both'}
        {ex.perSide && ' · per side'}{ex.id === 'assisted-pull-up' && ' · weight = assistance'}
      </div>
      {(!past || latest) && (
        <>
          <div className="kv">
            <span className="muted">Suggested</span>
            <div>{t.weightKg != null ? <><b>{load} × {t.repGoals.join('/')}</b><div className="muted small">{t.reason}</div></> : t.reason}</div>
          </div>
          <div className="kv">
            <span className="muted">Previous</span>
            <div>
              {prev ? <>{fmtDate(prev.session.startedAt)}, {sessionName(prev.session)} · {fmtSets(prev.entry.sets)} {review && <span className={`chip tiny ${review.tone}`}>{review.status}</span>}</> : <span className="muted">Not done yet</span>}
              {prev?.entry.note && <div className="muted small">{prev.entry.note}</div>}
              {alsoDone && <div className="muted small">Also {fmtDate(alsoDone.session.startedAt)}, {sessionName(alsoDone.session)} (off plan, not counted) · {fmtSets(alsoDone.entry.sets)}</div>}
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
