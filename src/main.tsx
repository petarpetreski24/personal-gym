import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/geist-mono/latin-400.css';
import App from './App.tsx';
import './style.css';

registerSW({ immediate: true });
createRoot(document.getElementById('root')!).render(<App />);
