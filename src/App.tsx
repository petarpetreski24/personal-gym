import { useEffect, useState } from 'react';
import { DataProvider, useData } from './store.tsx';
import { seedIfEmpty } from './db.ts';
import { weekNumber } from './engine.ts';
import Program from './screens/Program.tsx';
import History from './screens/History.tsx';
import Exercises from './screens/Exercises.tsx';
import Settings from './screens/Settings.tsx';
import DotField from './screens/DotField.tsx';

const TABS = ['Program', 'History', 'Exercises'] as const;
type Tab = (typeof TABS)[number];

function Shell() {
  const { settings: stored } = useData();
  const [tab, setTab] = useState<Tab>('Program');
  const [settings, setSettings] = useState(false);
  const week = weekNumber(new Date(), stored.blockStart);
  return (
    <>
      <DotField />
      <header>
        <span>Program [{week >= 1 ? `W${String(week).padStart(2, '0')}` : 'Pre'}]</span>
        <button className="textbtn" onClick={() => setSettings(true)}>Settings</button>
      </header>
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
