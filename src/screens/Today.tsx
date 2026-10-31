import { useState } from 'react';
import { useData } from '../store.tsx';
import { db, getEx } from '../db.ts';
import { DAYS, DAY_INFO } from '../seed/program.ts';
import { easyWeekSuggested, nextDay, targetFor, week5Offer, weekNumber } from '../engine.ts';
import { buildSession, resolveSlot, slotSets, slotsOf } from '../session.ts';
import { fmtNum } from '../util.ts';
import type { DayId } from '../types.ts';

export default function Today({ openSession }: { openSession: () => void }) {
  const { sessions, settings, overrides } = useData();
  const active = sessions.find((s) => !s.endedAt);
  const week = weekNumber(new Date(), settings.blockStart);
  const [pick, setPick] = useState<DayId | null>(null);
  const dayId = pick ?? nextDay(sessions);
  const day = DAYS.find((d) => d.id === dayId)!;
  const doneThisWeek = sessions.filter((s) => s.endedAt && s.dayId && s.dayId !== 'upperC' && s.weekNumber === week).length;

  const start = async () => {
    await db.sessions.put(buildSession(dayId, sessions, settings, overrides));
    openSession();
  };
  const acceptWeek5 = async () => {
    await db.overrides.bulkPut([{ slotId: 'A1', fromWeek: week, sets: 4 }, { slotId: 'A2', fromWeek: week, sets: 4 }]);
  };

  if (active) {
    return (
      <div className="card">
        <h2>Session in progress</h2>
        <p className="muted">{active.title} · started {new Date(active.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        <button className="btn primary big" onClick={openSession}>Resume</button>
      </div>
    );
  }

  return (
    <>
      {week5Offer(sessions, week, overrides) && (
        <div className="card note">
          <b>Week {week}:</b> add a 4th set to Bench and Lat Pulldown?
          <div className="row"><button className="btn primary" onClick={acceptWeek5}>Add 4th set</button></div>
        </div>
      )}
      {easyWeekSuggested(sessions, week, settings.equip, getEx) && (
        <div className="card note">Two rough weeks in a row on the main lifts. Consider an easy week at half the sets (your call).</div>
      )}
      <div className="card">
        <div className="between">
          <h2>{day.name}</h2>
          <span className="chip">Week {week > 0 ? week : 'pre-block'}</span>
        </div>
        <p className="muted">
          ~{DAY_INFO[day.id].mins} min · {DAY_INFO[day.id].when}
          {day.optional && ' · optional bonus'}
        </p>
        <ul className="plain">
          {slotsOf(dayId).map((slot) => {
            const r = resolveSlot(slot, week, settings);
            const ex = getEx(r.exerciseId);
            const n = slotSets(slot, overrides, week);
            const t = targetFor(ex, { ...slot, sets: n }, sessions, settings.equip);
            return (
              <li key={slot.id}>
                <div className="between">
                  <span>{ex.name}{r.variant && <span className="chip tiny">{r.variant}</span>}</span>
                  <span className="muted nowrap">{n}×{slot.repMin}–{slot.repMax}</span>
                </div>
                <div className="muted small">
                  {t.flags.includes('calibrate') ? 'calibrate' : t.weightKg == null ? t.reason : `${fmtNum(t.weightKg)} kg · ${t.repGoals.join('/')}`}
                </div>
              </li>
            );
          })}
        </ul>
        <button className="btn primary big" onClick={start}>Start session</button>
        <div className="row">
          <label className="muted small">Different day:&nbsp;
            <select value={dayId} onChange={(e) => setPick(e.target.value as DayId)}>
              {DAYS.map((d) => <option key={d.id} value={d.id}>{d.name}{d.optional ? ' (optional)' : ''}</option>)}
            </select>
          </label>
          {doneThisWeek >= 3 && dayId !== 'upperC' && (
            <button className="btn" onClick={() => setPick('upperC')}>Optional: Upper C</button>
          )}
        </div>
      </div>
    </>
  );
}
