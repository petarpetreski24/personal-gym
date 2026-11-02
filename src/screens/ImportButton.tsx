import { useState } from 'react';
import { useData } from '../store.tsx';
import { addImported, removeSessions } from '../db.ts';
import { parseHevy } from '../csv.ts';
import { sessionName } from '../engine.ts';
import { fmtDate } from '../util.ts';

export default function ImportButton() {
  const { settings } = useData();
  const [msg, setMsg] = useState('');
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const plan = await addImported(parseHevy(await f.text(), settings.blockStart));
      const parts = [];
      if (plan.add.length) parts.push(`${plan.add.length} new`);
      if (plan.update.length) parts.push(`${plan.update.length} updated from Hevy`);
      if (plan.keptEdited) parts.push(`${plan.keptEdited} changed in Hevy but kept, because you edited them here`);
      if (plan.missing.length) {
        const list = plan.missing.map((s) => `${fmtDate(s.startedAt)} ${sessionName(s)}`).join('\n');
        if (confirm(`These sessions are no longer in your Hevy export (deleted or re-timed there):\n\n${list}\n\nRemove them from the app?`)) {
          await removeSessions(plan.missing.map((s) => s.id));
          parts.push(`${plan.missing.length} removed`);
        } else parts.push(`${plan.missing.length} not in the export, kept`);
      }
      setMsg(parts.length ? `Import done: ${parts.join(', ')}.` : 'Nothing new. Already up to date.');
    } catch (err) {
      setMsg(`Import failed, nothing was changed: ${(err as Error).message}`);
    }
  };
  return (
    <div>
      <label className="btn primary block">Import Hevy CSV
        <input type="file" accept=".csv,text/csv" hidden onChange={onFile} />
      </label>
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}
