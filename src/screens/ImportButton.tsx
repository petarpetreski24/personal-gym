import { useMemo, useState } from 'react';
import { useData } from '../store.tsx';
import { addImported, addPasted, removeSessions } from '../db.ts';
import { parseHevy, type ImportPlan } from '../csv.ts';
import { sessionName } from '../engine.ts';
import { parseHevyText, pastedResult, pastedSession } from '../hevyText.ts';
import { fmtDate } from '../util.ts';

function planParts(plan: ImportPlan) {
  const parts = [];
  if (plan.add.length) parts.push(`${plan.add.length} new`);
  if (plan.update.length) parts.push(`${plan.update.length} updated from Hevy`);
  if (plan.keptEdited) parts.push(`${plan.keptEdited} changed in Hevy but kept, because you edited them here`);
  return parts;
}
const done = (parts: string[]) => (parts.length ? `Import done: ${parts.join(', ')}.` : 'Nothing new. Already up to date.');
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function PasteBox({ close }: { close: (msg: string) => void }) {
  const { settings } = useData();
  const [text, setText] = useState('');
  const [starts, setStarts] = useState<Record<number, string>>({});
  const parsed = useMemo(() => parseHevyText(text), [text]);
  const workouts = parsed.map((w, i) => ({ ...w, start: starts[i] ?? w.start }));
  const ready = workouts.length > 0 && workouts.every((w) => w.start && w.exercises.length);

  const save = async () => {
    try {
      const { plan, replaced } = await addPasted(pastedResult(workouts, settings.blockStart));
      const parts = planParts(plan);
      if (replaced) parts.push(`${replaced} replaced on the same day`);
      close(done(parts));
    } catch (err) {
      close(`Import failed, nothing was changed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="card">
      <h3>Paste from Hevy</h3>
      <textarea rows={5} value={text} aria-label="Workouts copied from Hevy" placeholder="Paste workouts copied from Hevy…"
        onChange={(e) => { setText(e.target.value); setStarts({}); }} />
      {text.trim() && !workouts.length && <p className="note small">No workouts found. Copy from a workout's title down to its last set.</p>}
      {workouts.map((w, i) => (
        <div key={i} className="rev">
          <b>{sessionName(pastedSession(w, settings.blockStart))}</b>
          <div className="muted small">{count(w.exercises.length, 'exercise')} · {count(w.exercises.reduce((n, e) => n + e.sets.length, 0), 'set')} · {w.minutes} min</div>
          <input type="datetime-local" aria-label={`Start of ${w.title}`} value={w.start} onChange={(e) => setStarts({ ...starts, [i]: e.target.value })} />
          {!w.start && <p className="note small">The date wasn't in the text. Set it above.</p>}
          {w.warmups.length > 0 && <p className="muted small">Counted as warm-up: {w.warmups.join(', ')}</p>}
          {w.warnings.map((x) => <p key={x} className="note small">{x}</p>)}
        </div>
      ))}
      <div className="row between">
        <button className="btn" disabled={!ready} onClick={save}>Add to history</button>
        <button className="btn" onClick={() => close('')}>Cancel</button>
      </div>
    </div>
  );
}

export default function ImportButton() {
  const { settings } = useData();
  const [msg, setMsg] = useState('');
  const [pasting, setPasting] = useState(false);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const plan = await addImported(parseHevy(await f.text(), settings.blockStart));
      const parts = planParts(plan);
      if (plan.missing.length) {
        const list = plan.missing.map((s) => `${fmtDate(s.startedAt)} ${sessionName(s)}`).join('\n');
        if (confirm(`These sessions are no longer in your Hevy export (deleted or re-timed there):\n\n${list}\n\nRemove them from the app?`)) {
          await removeSessions(plan.missing.map((s) => s.id));
          parts.push(`${plan.missing.length} removed`);
        } else parts.push(`${plan.missing.length} not in the export, kept`);
      }
      setMsg(done(parts));
    } catch (err) {
      setMsg(`Import failed, nothing was changed: ${(err as Error).message}`);
    }
  };
  if (pasting) return <PasteBox close={(m) => { setMsg(m); setPasting(false); }} />;
  return (
    <div>
      <button className="btn block" onClick={() => { setMsg(''); setPasting(true); }}>Paste from Hevy</button>
      <label className="btn primary block import-file">Import Hevy CSV
        <input type="file" accept=".csv,text/csv" hidden onChange={onFile} />
      </label>
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}
