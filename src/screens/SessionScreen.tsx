import { useEffect, useRef, useState } from 'react';
import { useData } from '../store.tsx';
import { db, getEx } from '../db.ts';
import { SLOT_BY_ID } from '../seed/program.ts';
import { bestE1rm, entriesFor, sessionFlags, workingSets } from '../engine.ts';
import { buildExercise, slotSets } from '../session.ts';
import { fmtDate, fmtNum, fmtSets, mmss } from '../util.ts';
import type { Session, SessionExercise, SetLog } from '../types.ts';

type Rest = { until: number; total: number } | null;
const REASONS = [['equipment_busy', 'Equipment busy'], ['equipment_missing', 'Equipment missing'], ['discomfort', 'Discomfort'], ['other', 'Other']] as const;

export default function SessionScreen({ initial, close }: { initial: Session; close: () => void }) {
  const { sessions, settings, overrides, notes } = useData();
  const [s, setS] = useState(initial);
  const [rest, setRest] = useState<Rest>(null);
  const [now, setNow] = useState(Date.now());
  const [finishing, setFinishing] = useState(false);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const buzzed = useRef(false);
  useEffect(() => {
    if (rest && now >= rest.until) {
      if (!buzzed.current) { buzzed.current = true; navigator.vibrate?.([200, 100, 200]); }
      if (now > rest.until + 4000) setRest(null);
    }
  }, [now, rest]);

  const update = (fn: (draft: Session) => Session) => {
    setS((prev) => { const next = fn(structuredClone(prev)); db.sessions.put(next); return next; });
  };
  const startRest = (sec: number) => { buzzed.current = false; setRest({ until: Date.now() + sec * 1000, total: sec }); };
  const elapsed = Math.floor((now - new Date(s.startedAt).getTime()) / 1000);

  return (
    <div className="session">
      <div className="topbar">
        <button className="btn" onClick={close}>‹ Back</button>
        <b>{s.title} · {mmss(elapsed)}</b>
        <button className="btn primary" onClick={() => setFinishing(true)}>Finish</button>
      </div>

      {s.exercises.map((se, i) => {
        const slot = se.slotId ? SLOT_BY_ID[se.slotId] : undefined;
        const prevSlot = s.exercises[i - 1] && SLOT_BY_ID[s.exercises[i - 1].slotId ?? ''];
        const linked = !!slot?.superset && prevSlot?.superset === slot.superset;
        return (
          <ExerciseCard
            key={se.slotId ?? se.exerciseId + i} se={se} linked={linked} sessions={sessions} current={s}
            notes={notes} slotName={slot?.label}
            onChange={(fn) => update((d) => { fn(d.exercises[i]); return d; })}
            onSwap={(exId, reason) => update((d) => {
              const old = d.exercises[i];
              const fresh = buildExercise(slot!, exId, sessions, settings, overrides, d.weekNumber, d.id);
              d.exercises[i] = { ...fresh, swappedFromExerciseId: old.swappedFromExerciseId ?? old.exerciseId, swapReason: reason };
              return d;
            })}
            onSetDone={() => {
              if (!slot) return startRest(getEx(se.exerciseId).type === 'compound' ? 150 : 75);
              if (slot.superset) {
                const isFirst = !(linked);
                if (!isFirst) startRest(90);
              } else startRest(getEx(se.exerciseId).type === 'compound' ? 150 : 75);
            }}
          />
        );
      })}

      {rest && (
        <div className={`rest ${now >= rest.until ? 'done' : ''}`}>
          <b>{now >= rest.until ? 'Rest over – go!' : `Rest ${mmss((rest.until - now) / 1000)}`}</b>
          <button className="btn" onClick={() => setRest(null)}>Skip</button>
        </div>
      )}

      {finishing && (
        <Finish
          session={s} sessions={sessions} close={() => setFinishing(false)}
          onSave={async (remark) => {
            const cleaned: Session = {
              ...s, remark: remark || undefined, endedAt: new Date().toISOString(),
              exercises: s.exercises
                .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done).map((x, k) => ({ ...x, index: k })) }))
                .filter((e) => e.slotId || e.sets.length),
            };
            await db.sessions.put(cleaned);
            close();
          }}
          onDiscard={async () => { await db.sessions.delete(s.id); close(); }}
        />
      )}
    </div>
  );
}

function ExerciseCard({ se, linked, sessions, current, notes, slotName, onChange, onSwap, onSetDone }: {
  se: SessionExercise; linked: boolean; sessions: Session[]; current: Session;
  notes: { exerciseId: string; text: string }[]; slotName?: string;
  onChange: (fn: (e: SessionExercise) => void) => void;
  onSwap: (exId: string, reason: NonNullable<SessionExercise['swapReason']>) => void;
  onSetDone: () => void;
}) {
  const ex = getEx(se.exerciseId);
  const slot = se.slotId ? SLOT_BY_ID[se.slotId] : undefined;
  const [swap, setSwap] = useState(false);
  const [reason, setReason] = useState<NonNullable<SessionExercise['swapReason']>>('equipment_busy');
  const prev = entriesFor(ex.id, sessions, { excludeId: current.id }).slice(0, 3);
  const noteRow = notes.find((n) => n.exerciseId === ex.id);
  const [myNote, setMyNote] = useState(noteRow?.text ?? '');
  const goal = se.sets.find((x) => x.type !== 'warmup');

  const setAt = (k: number, patch: Partial<SetLog>) => onChange((e) => { e.sets[k] = { ...e.sets[k], ...patch }; });
  const num = (v: string) => (v === '' ? null : Number(v));

  return (
    <div className={`card ex ${linked ? 'linked' : ''}`}>
      {slot?.superset && <div className="muted small">Superset {slot.superset}</div>}
      <div className="between">
        <h3>{ex.name}</h3>
        {slot?.kind === 'rotating' && <button className="btn small" onClick={() => setSwap(!swap)}>Swap</button>}
      </div>
      <div className="chips">
        <span className="chip">{ex.type === 'compound' ? 'Compound' : 'Isolation'}</span>
        <span className="chip">{slot ? (slot.kind === 'fixed' ? 'Fixed' : 'Rotates') : 'Extra'}</span>
        {slotName && <span className="chip dim">{slotName}</span>}
        {se.swapReason && <span className="chip warn">swapped: {se.swapReason.replace('_', ' ')}</span>}
      </div>

      {swap && slot?.variants && (
        <div className="panel">
          <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {(['A', 'B', 'C'] as const).filter((v) => slot.variants![v] !== se.exerciseId).map((v) => (
            <button key={v} className="btn block" onClick={() => { onSwap(slot.variants![v], reason); setSwap(false); }}>
              {v}: {getEx(slot.variants![v]).name}
            </button>
          ))}
        </div>
      )}

      <details className="how">
        <summary>How to do it</summary>
        <p>{ex.description || 'No description.'}</p>
        {ex.cues.length > 0 && <ul>{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>}
      </details>

      <div className="prev">
        <span className="muted small">Previous</span>
        {prev.length === 0 && <div className="small">No history yet</div>}
        {prev.map((p) => (
          <div key={p.session.id} className="small">
            {fmtDate(p.session.startedAt)} · {fmtSets(p.entry.sets)}
            {p.entry.note && <em className="muted"> — {p.entry.note}</em>}
          </div>
        ))}
      </div>
      <div className="target">
        <b>Target:</b>{' '}
        {goal && goal.weightKg != null ? `${fmtNum(goal.weightKg)} kg × ${se.sets.filter((x) => x.type !== 'warmup').map((x) => x.reps).join('/')}` : 'pick a load'}
        <div className="muted small">{se.reason}</div>
      </div>

      <textarea
        className="mynote" placeholder="My notes (seat height, setup…)" rows={1} value={myNote}
        onChange={(e) => setMyNote(e.target.value)}
        onBlur={() => (myNote ? db.exerciseNotes.put({ exerciseId: ex.id, text: myNote }) : db.exerciseNotes.delete(ex.id))}
      />

      <div className="sets">
        <div className="setrow head"><span>#</span><span>kg{ex.perSide ? '/side' : ''}</span><span>reps</span><span>RPE</span><span>W</span><span>✓</span></div>
        {se.sets.map((x, k) => (
          <div key={k} className={`setrow ${x.done ? 'done' : ''}`}>
            <span className="muted">{x.type === 'warmup' ? 'W' : se.sets.slice(0, k).filter((y) => y.type !== 'warmup').length + 1}</span>
            <input inputMode="decimal" value={x.weightKg ?? ''} placeholder="BW" onChange={(e) => setAt(k, { weightKg: num(e.target.value) })} />
            <input inputMode="numeric" value={x.reps ?? ''} onChange={(e) => setAt(k, { reps: num(e.target.value) })} />
            <input inputMode="decimal" value={x.rpe ?? ''} placeholder="–" onChange={(e) => setAt(k, { rpe: num(e.target.value) ?? undefined })} />
            <button className={`tog ${x.type === 'warmup' ? 'on' : ''}`} onClick={() => setAt(k, { type: x.type === 'warmup' ? 'working' : 'warmup' })}>W</button>
            <button className={`tog check ${x.done ? 'on' : ''}`} onClick={() => { setAt(k, { done: !x.done }); if (!x.done) onSetDone(); }}>✓</button>
          </div>
        ))}
      </div>
      <div className="row">
        <button className="btn small" onClick={() => onChange((e) => { e.sets.unshift({ index: 0, type: 'warmup', weightKg: null, reps: 10 }); })}>+ Warm-up</button>
        <button className="btn small" onClick={() => onChange((e) => { const l = e.sets[e.sets.length - 1]; e.sets.push({ index: e.sets.length, type: 'working', weightKg: l?.weightKg ?? null, reps: l?.reps ?? null }); })}>+ Set</button>
      </div>
      <input className="mynote" placeholder="Note for this session" value={se.note ?? ''} onChange={(e) => onChange((x) => { x.note = e.target.value || undefined; })} />
    </div>
  );
}

function Finish({ session, sessions, close, onSave, onDiscard }: {
  session: Session; sessions: Session[]; close: () => void; onSave: (remark: string) => void; onDiscard: () => void;
}) {
  const [remark, setRemark] = useState(session.remark ?? '');
  const mins = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000);
  const done: Session = { ...session, endedAt: new Date().toISOString(), exercises: session.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })) };
  const nSets = done.exercises.reduce((a, e) => a + workingSets(e.sets).length, 0);
  const prs: string[] = [];
  for (const e of done.exercises) {
    const past = entriesFor(e.exerciseId, sessions, { excludeId: session.id });
    if (!past.length || !workingSets(e.sets).length) continue;
    const bestPast = Math.max(...past.map((p) => bestE1rm(p.entry.sets)));
    if (bestE1rm(e.sets) > bestPast + 1e-6) prs.push(`${getEx(e.exerciseId).name}: e1RM ${fmtNum(bestE1rm(e.sets))} kg`);
  }
  const flags = sessionFlags({ ...done, dayId: session.dayId }, getEx);
  void slotSets;
  return (
    <div className="modal">
      <div className="card">
        <h2>Finish session</h2>
        <p>{mins} min · {nSets} working sets</p>
        {prs.length > 0 && <><b>Personal records</b><ul>{prs.map((p) => <li key={p}>🏆 {p}</li>)}</ul></>}
        {flags.length > 0 && <><b>Flags</b><ul>{flags.map((f) => <li key={f}>⚠ {f}</li>)}</ul></>}
        <textarea rows={3} placeholder="Session remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
        <div className="row">
          <button className="btn primary big" onClick={() => onSave(remark)}>Save</button>
          <button className="btn" onClick={close}>Keep going</button>
        </div>
        <button className="btn danger small" onClick={() => confirm('Discard this session?') && onDiscard()}>Discard session</button>
      </div>
    </div>
  );
}
