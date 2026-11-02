import { useState } from 'react';
import { useData } from '../store.tsx';
import { db, getEx } from '../db.ts';
import { DAYS, DAY_INFO, SLOTS } from '../seed/program.ts';
import { fmtDate, fmtDay, fmtNum, fmtSets, mmss } from '../util.ts';
import { dayOfSession, entriesFor, finished, navigableWeeks, offPlanEntries, onSlotDay, reviewExercise, targetFor, variantForWeek, weekNumber, weekRange, workingSets } from '../engine.ts';
import { LETTERS, autoVariant, plannedVariant, rotatingSlots } from '../rotation.ts';
import type { Slot } from '../types.ts';

const restSeconds = (slot: Slot, exerciseId: string) => (slot.superset ? 90 : getEx(exerciseId).type === 'compound' ? 150 : 75);

export default function Program() {
  const { settings, sessions, rotation } = useData();
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

  const lock = (slot: Slot, variant: 'A' | 'B' | 'C') => db.rotation.put({ id: `${week}:${slot.id}`, weekNumber: week, slotId: slot.id, variant, exerciseId: slot.variants![variant] });
  const unlock = (slotId: string) => db.rotation.delete(`${week}:${slotId}`);

  /* what was actually logged, by week */
  const histWeeks = [...new Set(logged.map((s) => s.weekNumber))].sort((a, b) => b - a);
  const doneVariant = (w: number, slot: Slot) => {
    const ids = new Set(logged.filter((s) => s.weekNumber === w && onSlotDay(s, slot)).flatMap((s) => s.exercises.filter((e) => workingSets(e.sets).length).map((e) => e.exerciseId)));
    return LETTERS.filter((l) => ids.has(slot.variants![l]));
  };

  return (
    <>
      <div className="card weekhead">
        <div className="between">
          <button className="btn" aria-label="Previous week" disabled={idx <= 0} onClick={() => setWeek(weeks[idx - 1])}>&lt;</button>
          <div className="center">
            <b>{weekLabel(week)}{week === cur ? ' · this week' : ''}</b>
            <div className="muted small">{fmtDay(start)} – {fmtDay(end)} · variant {variantForWeek(week)}</div>
          </div>
          <button className="btn" aria-label="Next week" disabled={idx >= weeks.length - 1} onClick={() => setWeek(weeks[idx + 1])}>&gt;</button>
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
              <b>{d.name}</b>
              <span>
                {DAY_INFO[d.id].when} · {DAY_INFO[d.id].mins} min · {slots.reduce((a, s) => a + s.sets, 0)} sets
                <div className="muted">{done ? `Done ${fmtDay(new Date(done.startedAt))}` : !past && `${locked}/${rotating.length} locked`}</div>
              </span>
            </summary>
            {slots.map((s) => (
              <div key={s.id} className={`slot ${s.superset ? 'ss' : ''}`}>
                {s.kind === 'fixed'
                  ? <ExerciseRow slot={s} exerciseId={s.exerciseId!} week={week} />
                  : <RotatingSlot slot={s} week={week} past={past} lock={lock} unlock={unlock} done={doneVariant(week, s)} />}
              </div>
            ))}
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
        <p className="muted small">A &gt; B &gt; C, repeating. [/] marks an exercise you locked.</p>
        {Array.from({ length: 6 }, (_, i) => first + i).map((w) => {
          const r = weekRange(w, settings.blockStart);
          return (
            <details key={w} className="cal" open={w === first}>
              <summary>{weekLabel(w)} · {fmtDay(r.start)} – {fmtDay(r.end)} <span className="chip tiny">{variantForWeek(w)}</span></summary>
              {rotatingSlots(true).map((s) => {
                const p = plannedVariant(s, w, settings, rotation);
                return <div key={s.id} className="between small prow"><span className="muted">{s.label}</span><span className="right">{p.locked && '[/] '}{getEx(p.exerciseId).name}</span></div>;
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
  lock: (slot: Slot, v: 'A' | 'B' | 'C') => void; unlock: (slotId: string) => void;
}) {
  const { settings, rotation } = useData();
  const auto = autoVariant(slot, week, settings).variant;
  const p = plannedVariant(slot, week, settings, rotation);
  const [letter, setLetter] = useState(auto);
  const [open, setOpen] = useState(false);

  if (past) {
    const shown = done.length ? done : [p.variant];
    return <>{shown.map((l) => <ExerciseRow key={l} slot={slot} exerciseId={slot.variants![l]} week={week} letter={l} />)}</>;
  }

  // the carousel skips options whose equipment is marked unavailable
  const usable = LETTERS.filter((l) => {
    const eq = getEx(slot.variants![l]).equipment;
    return !eq || !settings.equip.unavailable.includes(eq);
  });
  const options = usable.length ? usable : LETTERS;
  const step = (by: 1 | -1) => setLetter(options[(options.indexOf(letter) + by + options.length) % options.length]);
  const shown = p.locked ? p.variant : letter;
  const exerciseId = p.locked ? p.exerciseId : slot.variants![letter];

  return (
    <>
      <div className={`carousel ${p.locked ? 'locked' : ''}`}>
        {!p.locked && <button className="navbtn" aria-label={`Previous ${slot.label} option`} onClick={() => step(-1)}>[&lt;]</button>}
        <div className="carname">
          <ExerciseName exerciseId={exerciseId} open={open} toggle={() => setOpen(!open)} set={p.locked} bare={!p.locked} />
          {!p.locked && (
            <div className="dots" aria-hidden="true">
              {options.map((l) => <span key={l} className={`dot ${l === letter ? 'on' : ''} ${l === auto ? 'plan' : ''}`}>{l}</span>)}
            </div>
          )}
        </div>
        {!p.locked && <button className="navbtn" aria-label={`Next ${slot.label} option`} onClick={() => step(1)}>[&gt;]</button>}
        {p.locked
          ? <button className="navbtn lockbtn on" aria-label={`Unlock ${getEx(exerciseId).name}`} onClick={() => { setLetter(p.variant); unlock(slot.id); }}>[Unlock]</button>
          : <button className="navbtn lockbtn" aria-label={`Lock ${getEx(exerciseId).name} for this week`} onClick={() => lock(slot, letter)}>[Lock]</button>}
      </div>
      {open && <ExerciseInfo slot={slot} exerciseId={exerciseId} week={week} letter={shown} planned={shown === auto} locked={p.locked} />}
    </>
  );
}

/** `set` marks an exercise that is decided: fixed, or locked for the week. `bare` is the name alone, for the carousel. */
function ExerciseName({ exerciseId, open, toggle, dim, set, bare }: { exerciseId: string; open: boolean; toggle: () => void; dim?: boolean; set?: boolean; bare?: boolean }) {
  return (
    <button className={`exname ${dim ? 'muted' : ''}`} aria-expanded={open} onClick={toggle}>
      {set && <span className="mark" aria-hidden="true">[/]</span>}
      <span className={bare ? '' : 'nm'}>{getEx(exerciseId).name}</span>
      {!bare && <span className="fold" aria-hidden="true">{open ? '[-]' : '[+]'}</span>}
    </button>
  );
}

function ExerciseRow({ slot, exerciseId, week, letter }: { slot: Slot; exerciseId: string; week: number; letter?: string }) {
  const { sessions, settings } = useData();
  const [open, setOpen] = useState(false);
  const notLogged = week < weekNumber(new Date(), settings.blockStart)
    && !entriesFor(exerciseId, sessions.filter((s) => s.weekNumber === week && onSlotDay(s, slot))).length;
  return (
    <>
      <ExerciseName exerciseId={exerciseId} open={open} toggle={() => setOpen(!open)} dim={notLogged} set />
      {open && <ExerciseInfo slot={slot} exerciseId={exerciseId} week={week} letter={letter} />}
    </>
  );
}

function ExerciseInfo({ slot, exerciseId, week, letter, planned, locked }: { slot: Slot; exerciseId: string; week: number; letter?: string; planned?: boolean; locked?: boolean }) {
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
        {slot.label}{slot.superset && ` · superset ${slot.superset}`} · {slot.kind === 'fixed' ? 'Fixed' : 'Rotates'}
        {letter && ` · variant ${letter}`}{planned && ' · planned'}{locked && ' · locked'}
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
              {prev ? <>{fmtDate(prev.session.startedAt)}, {prev.session.title} · {fmtSets(prev.entry.sets)} {review && <span className={`chip tiny ${review.tone}`}>{review.status}</span>}</> : <span className="muted">Not done yet</span>}
              {prev?.entry.note && <div className="muted small">{prev.entry.note}</div>}
              {alsoDone && <div className="muted small">Also {fmtDate(alsoDone.session.startedAt)}, {alsoDone.session.title} (off plan, not counted) · {fmtSets(alsoDone.entry.sets)}</div>}
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
