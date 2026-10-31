import { useState } from 'react';
import { useData } from '../store.tsx';
import { addImported } from '../db.ts';
import { parseHevy } from '../csv.ts';

export default function ImportButton() {
  const { settings } = useData();
  const [msg, setMsg] = useState('');
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const n = await addImported(parseHevy(await f.text(), settings.blockStart));
      setMsg(n ? `Imported ${n} new session${n > 1 ? 's' : ''}` : 'Nothing new – already up to date');
    } catch (err) {
      setMsg(`Import failed: ${(err as Error).message}`);
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
