import { useEffect, useState } from 'react';
import { DataProvider, useData } from './store.tsx';
import { seedIfEmpty } from './db.ts';
import Today from './screens/Today.tsx';
import SessionScreen from './screens/SessionScreen.tsx';
import History from './screens/History.tsx';
import Program from './screens/Program.tsx';
import Exercises from './screens/Exercises.tsx';
import Progress from './screens/Progress.tsx';
import Settings from './screens/Settings.tsx';

const TABS = ['Today', 'History', 'Program', 'Exercises', 'Progress'] as const;
type Tab = (typeof TABS)[number];

function Shell() {
  const { sessions } = useData();
  const [tab, setTab] = useState<Tab>('Today');
  const [overlay, setOverlay] = useState<'session' | 'settings' | null>(null);
  const active = sessions.find((s) => !s.endedAt);

  if (overlay === 'session' && active) return <main><SessionScreen key={active.id} initial={active} close={() => setOverlay(null)} /></main>;
  return (
    <>
      <header><b>Gym Tracker</b><button className="gear" aria-label="Settings" onClick={() => setOverlay('settings')}>⚙</button></header>
      <main>
        {overlay === 'settings' ? <Settings back={() => setOverlay(null)} /> : (
          <>
            {tab === 'Today' && <Today openSession={() => setOverlay('session')} />}
            {tab === 'History' && <History />}
            {tab === 'Program' && <Program />}
            {tab === 'Exercises' && <Exercises />}
            {tab === 'Progress' && <Progress />}
          </>
        )}
      </main>
      <nav>
        {TABS.map((t) => <button key={t} className={t === tab && !overlay ? 'on' : ''} onClick={() => { setOverlay(null); setTab(t); }}>{t}</button>)}
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
