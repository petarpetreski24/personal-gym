import { useState } from 'react';
import { useData } from '../store.tsx';
import { addImported, exportAll, getEx, importAll, resetAll, saveSettings } from '../db.ts';
import { LIBRARY } from '../seed/library.ts';
import { parseHevy } from '../csv.ts';
import { download } from '../util.ts';

const EQUIPMENT = [...new Set(LIBRARY.map((e) => e.equipment).filter(Boolean))] as string[];

export default function Settings({ back }: { back: () => void }) {
  const { settings } = useData();
  const [msg, setMsg] = useState('');
  const [dbs, setDbs] = useState(settings.equip.dumbbells.join(', '));
  const eq = settings.equip;
  const save = (patch: Partial<typeof settings>) => saveSettings({ ...settings, ...patch });
  const saveEq = (patch: Partial<typeof eq>) => save({ equip: { ...eq, ...patch } });

  const readFile = (cb: (text: string) => Promise<void>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    f.text().then(cb).catch((err) => setMsg(String(err.message ?? err)));
  };

  return (
    <>
      <button className="btn" onClick={back}>‹ Back</button>
      <div className="card">
        <h3>Block</h3>
        <label>Block start (Monday)<input type="date" value={settings.blockStart} onChange={(e) => e.target.value && save({ blockStart: e.target.value })} /></label>
      </div>
      <div className="card">
        <h3>Equipment</h3>
        <label>Dumbbell weights (kg, comma separated)
          <input value={dbs} onChange={(e) => setDbs(e.target.value)}
            onBlur={() => { const l = dbs.split(',').map((x) => Number(x.trim())).filter((x) => x > 0).sort((a, b) => a - b); if (l.length) saveEq({ dumbbells: l }); }} />
        </label>
        <label>Cable stack step (kg)<input inputMode="decimal" defaultValue={eq.cableStep} onBlur={(e) => Number(e.target.value) > 0 && saveEq({ cableStep: Number(e.target.value) })} /></label>
        <label>Barbell / machine increment (kg)<input inputMode="decimal" defaultValue={eq.barStep} onBlur={(e) => Number(e.target.value) > 0 && saveEq({ barStep: Number(e.target.value) })} /></label>
        <p className="muted small">Unavailable equipment (rotation skips these):</p>
        {EQUIPMENT.map((q) => (
          <label key={q} className="check">
            <input type="checkbox" checked={eq.unavailable.includes(q)}
              onChange={(e) => saveEq({ unavailable: e.target.checked ? [...eq.unavailable, q] : eq.unavailable.filter((x) => x !== q) })} /> {q}
          </label>
        ))}
      </div>
      <div className="card">
        <h3>Data</h3>
        <label className="btn block">Import Hevy CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={readFile(async (t) => {
            const n = await addImported(parseHevy(t, settings.blockStart));
            setMsg(`Imported ${n} new sessions`);
          })} />
        </label>
        <button className="btn block" onClick={async () => download(`gym-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportAll())}>Export JSON backup</button>
        <label className="btn block">Import JSON backup
          <input type="file" accept=".json,application/json" hidden onChange={readFile(async (t) => {
            if (!confirm('Replace all current data with this backup?')) return;
            await importAll(t); setMsg('Backup restored');
          })} />
        </label>
        <button className="btn danger block" onClick={async () => { if (confirm('Delete ALL data? This cannot be undone.')) { await resetAll(); setMsg('All data deleted'); } }}>Reset all data</button>
        {msg && <p className="note">{msg}</p>}
        <p className="muted small">{getEx('bench-press-barbell').name} … data stays on this device only.</p>
      </div>
    </>
  );
}
