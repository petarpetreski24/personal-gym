import { useEffect, useState } from 'react';
import { DataProvider } from './store.tsx';
import { seedIfEmpty } from './db.ts';
import Program from './screens/Program.tsx';
import History from './screens/History.tsx';
import Exercises from './screens/Exercises.tsx';
import Settings from './screens/Settings.tsx';

const TABS = ['Program', 'History', 'Exercises'] as const;
type Tab = (typeof TABS)[number];

function Shell() {
  const [tab, setTab] = useState<Tab>('Program');
  const [settings, setSettings] = useState(false);
  return (
    <>
      <header><b>Gym Tracker</b><button className="gear" aria-label="Settings" onClick={() => setSettings(true)}>⚙</button></header>
      <main>
        {settings ? <Settings back={() => setSettings(false)} /> : (
          <>
            {tab === 'Program' && <Program />}
            {tab === 'History' && <History />}
            {tab === 'Exercises' && <Exercises />}
          </>
        )}
      </main>
      <nav>
        {TABS.map((t) => <button key={t} className={t === tab && !settings ? 'on' : ''} onClick={() => { setSettings(false); setTab(t); }}>{t}</button>)}
      </nav>
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { seedIfEmpty().then(() => setReady(true)); }, []);
  if (!ready) return null;
  return <DataProvider><Shell /></DataProvider>;
}
