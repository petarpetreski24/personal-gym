import { useState } from 'react';
import { useData } from '../store.tsx';
import { db, getEx } from '../db.ts';
import { LIBRARY } from '../seed/library.ts';
import { SLOTS } from '../seed/program.ts';
import { bestE1rm, entriesFor, workingSets, e1rm } from '../engine.ts';
import { MUSCLE_NAME, fmtDate, fmtNum, fmtSets } from '../util.ts';
import { SeriesChart, seriesFor } from './Charts.tsx';
import type { Exercise } from '../types.ts';

export default function Exercises() {
  const { sessions } = useData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <Detail id={open} back={() => setOpen(null)} />;

  const used = new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
  const all: Exercise[] = [...LIBRARY, ...[...used].filter((id) => id.startsWith('legacy-')).map(getEx)];
  const list = all.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  const groups = new Map<string, Exercise[]>();
  list.forEach((e) => { const g = e.legacy ? 'Legacy' : MUSCLE_NAME(e.primary[0]); groups.set(g, [...(groups.get(g) ?? []), e]); });

  return (
    <>
      <input className="search" type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      {[...groups].map(([g, es]) => (
        <div key={g} className="card">
          <h3 className="cap">{g}</h3>
          {es.map((e) => (
            <button key={e.id} className="listbtn" onClick={() => setOpen(e.id)}>
              <span>{e.name}</span>
              <span>{!e.legacy && <span className="chip tiny">{SLOTS.some((s) => s.exerciseId === e.id) ? 'Fixed' : 'Rotates'}</span>}<span className="chip tiny">{e.type === 'compound' ? 'C' : 'I'}</span></span>
            </button>
          ))}
        </div>
      ))}
    </>
  );
}

function Detail({ id, back }: { id: string; back: () => void }) {
  const { sessions, notes } = useData();
  const ex = getEx(id);
  const hist = entriesFor(id, sessions);
  const slots = SLOTS.filter((s) => s.exerciseId === id || Object.values(s.variants ?? {}).includes(id));
  const [note, setNote] = useState(notes.find((n) => n.exerciseId === id)?.text ?? '');
  const all = hist.flatMap((h) => workingSets(h.entry.sets));
  const heaviest = all.length ? Math.max(...all.map((s) => s.weightKg ?? 0)) : 0;
  const bestVol = all.length ? all.reduce((b, s) => ((s.weightKg ?? 0) * s.reps! > (b.weightKg ?? 0) * b.reps! ? s : b)) : null;
  const best = hist.length ? Math.max(...hist.map((h) => bestE1rm(h.entry.sets))) : 0;

  return (
    <>
      <button className="btn" onClick={back}>‹ Back</button>
      <div className="card">
        <h2>{ex.name}</h2>
        <div className="chips">
          <span className="chip">{ex.type}</span>
          {slots.map((s) => {
            const letter = s.variants ? (Object.entries(s.variants).find(([, v]) => v === id)?.[0] ?? '') : '';
            return <span key={s.id} className="chip dim">{s.id}{letter && ` · ${letter}`}</span>;
          })}
          {ex.perSide && <span className="chip dim">per side</span>}
        </div>
        <p>{ex.description || 'Legacy exercise – no description.'}</p>
        {ex.cues.length > 0 && <ul>{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>}
        <textarea rows={2} placeholder="My notes" value={note} onChange={(e) => setNote(e.target.value)}
          onBlur={() => (note ? db.exerciseNotes.put({ exerciseId: id, text: note }) : db.exerciseNotes.delete(id))} />
      </div>
      <div className="card">
        <h3>Personal records</h3>
        <div className="between small"><span>Heaviest</span><b>{fmtNum(heaviest)} kg</b></div>
        <div className="between small"><span>Best e1RM</span><b>{fmtNum(best)} kg</b></div>
        <div className="between small"><span>Best volume set</span><b>{bestVol ? `${fmtNum(bestVol.weightKg)}×${bestVol.reps} (${fmtNum(e1rm(bestVol.weightKg ?? 0, bestVol.reps!))} e1RM)` : '–'}</b></div>
        <h3>e1RM over time</h3>
        <SeriesChart data={seriesFor(id, sessions)} />
      </div>
      <div className="card">
        <h3>History</h3>
        {hist.length === 0 && <div className="muted">Nothing logged yet.</div>}
        {hist.map((h) => <div key={h.session.id} className="small">{fmtDate(h.session.startedAt)} · {fmtSets(h.entry.sets)}</div>)}
      </div>
    </>
  );
}
