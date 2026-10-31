import { useState } from 'react';
import { useData } from '../store.tsx';
import { db, getEx } from '../db.ts';
import { MUSCLE_TARGETS } from '../seed/program.ts';
import { finished, sessionFlags, sessionMinutes, weekNumber, weekRange, weeklyReview, weeklyVolume, workingSets } from '../engine.ts';
import { fmtDay, fmtNum, fmtSets } from '../util.ts';
import type { Session } from '../types.ts';

const PRE_FIX = new Date(2026, 8, 23);

export default function History() {
  const { sessions, settings, remarks } = useData();
  const cur = weekNumber(new Date(), settings.blockStart);
  const [week, setWeek] = useState(cur - 1);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('hideWarmupBanner') === '1'; } catch { return false; } });
  const { start, end } = weekRange(week, settings.blockStart);
  const inWeek = finished(sessions).filter((s) => s.weekNumber === week);
  const review = weeklyReview(sessions, week, settings.equip, getEx);
  const vol = weeklyVolume(sessions, week, getEx);
  const remark = remarks.find((r) => r.weekNumber === week)?.text ?? '';
  const [text, setText] = useState(remark);
  const [copied, setCopied] = useState(false);
  const label = week >= 1 ? `Week ${week}` : 'Pre-block';

  const go = (w: number) => { setWeek(w); setText(remarks.find((r) => r.weekNumber === w)?.text ?? ''); };
  const saveRemark = () => (text.trim() ? db.weekRemarks.put({ weekNumber: week, text }) : db.weekRemarks.delete(week));

  const editSet = (s: Session, ei: number, si: number, patch: { weightKg?: number | null; reps?: number | null }) => {
    const next = structuredClone(s);
    Object.assign(next.exercises[ei].sets[si], patch);
    db.sessions.put(next);
  };

  const summary = () => {
    const lines = [`${label} (${fmtDay(start)}–${fmtDay(end)}): ${inWeek.length} sessions`];
    inWeek.forEach((s) => {
      lines.push('', `${s.title} – ${fmtDay(new Date(s.startedAt))}, ${Math.round(sessionMinutes(s))} min${s.remark ? ` – ${s.remark}` : ''}`);
      s.exercises.forEach((e) => { if (workingSets(e.sets).length) lines.push(`- ${getEx(e.exerciseId).name}: ${fmtSets(e.sets)}`); });
    });
    lines.push('', 'Review:');
    review.forEach((r) => lines.push(`- ${getEx(r.exerciseId).name}: ${r.review.status} → next ${r.next.weightKg != null ? `${fmtNum(r.next.weightKg)} kg ${r.next.repGoals.join('/')}` : r.next.reason}`));
    lines.push('', 'Hard sets: ' + MUSCLE_TARGETS.map((t) => `${t.label} ${fmtNum(vol[t.muscle] ?? 0)}`).join(', '));
    if (remark) lines.push('', 'Remarks:', remark);
    navigator.clipboard.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  return (
    <>
      <div className="card between">
        <button className="btn" onClick={() => go(week - 1)}>‹</button>
        <div className="center"><b>{label}</b><div className="muted small">{fmtDay(start)} – {fmtDay(end)}</div></div>
        <button className="btn" onClick={() => go(week + 1)}>›</button>
      </div>
      <div className="row"><button className="chip btnchip" onClick={() => go(cur)}>This week</button><button className="chip btnchip" onClick={() => go(cur - 1)}>Last week</button></div>

      {!hidden && start < PRE_FIX && inWeek.some((s) => s.source === 'hevy_import') && (
        <div className="card note">Warm-ups before 23 Sep 2026 were logged as normal sets in Hevy, so those weeks may look heavier than they were.
          <div className="row"><button className="btn small" onClick={() => { setHidden(true); try { localStorage.setItem('hideWarmupBanner', '1'); } catch { /* ignore */ } }}>Dismiss</button></div></div>
      )}

      {inWeek.length === 0 && <div className="card muted">No sessions this week.</div>}
      {inWeek.map((s) => (
        <details key={s.id} className="card">
          <summary><b>{s.title}</b> · {fmtDay(new Date(s.startedAt))} · {Math.round(sessionMinutes(s))} min</summary>
          {s.remark && <p><em>{s.remark}</em></p>}
          {sessionFlags(s, getEx).map((f) => <div key={f} className="chip warn block">{f}</div>)}
          {s.exercises.map((e, ei) => e.sets.length > 0 && (
            <div key={ei} className="hex">
              <b>{getEx(e.exerciseId).name}</b>{e.note && <em className="muted"> — {e.note}</em>}
              {e.sets.map((x, si) => (
                <div key={si} className="hset">
                  <span className="muted">{x.type === 'warmup' ? 'W' : si + 1}</span>
                  <input inputMode="decimal" defaultValue={x.weightKg ?? ''} placeholder="BW" onBlur={(ev) => editSet(s, ei, si, { weightKg: ev.target.value === '' ? null : Number(ev.target.value) })} />
                  <span>×</span>
                  <input inputMode="numeric" defaultValue={x.reps ?? ''} onBlur={(ev) => editSet(s, ei, si, { reps: ev.target.value === '' ? null : Number(ev.target.value) })} />
                </div>
              ))}
            </div>
          ))}
        </details>
      ))}

      {review.length > 0 && (
        <div className="card">
          <h3>Auto review</h3>
          {review.map((r, i) => (
            <div key={i} className="rev">
              <div className="between"><b>{getEx(r.exerciseId).name}</b><span className={`chip ${r.review.tone}`}>{r.review.status}</span></div>
              <div className="small">{fmtSets(r.sets)}</div>
              <div className="muted small">{r.review.text} · next: {r.next.weightKg != null ? `${fmtNum(r.next.weightKg)} kg × ${r.next.repGoals.join('/')}` : r.next.reason}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Week remarks</h3>
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} onBlur={saveRemark} placeholder="Notes for this week…" />
      </div>

      <div className="card">
        <h3>Hard sets · {inWeek.length} sessions</h3>
        {MUSCLE_TARGETS.map((t) => {
          const v = vol[t.muscle] ?? 0;
          const cls = v >= t.min ? 'ok' : t.note === 'by choice' ? 'neutral' : 'warn';
          return <div key={t.muscle} className="between small"><span>{t.label}</span><span><span className={`chip ${cls}`}>{fmtNum(v)}</span> <span className="muted">/ {t.min}{t.max ? `–${t.max}` : '+'}{t.note ? ` ${t.note}` : ''}</span></span></div>;
        })}
      </div>
      <button className="btn primary big" onClick={summary}>{copied ? 'Copied ✓' : 'Copy week summary'}</button>
    </>
  );
}
