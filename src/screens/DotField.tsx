import { useEffect, useRef } from 'react';

const SPACING = 14;
const FPS = 20; // a slow background doesn't need more, and it saves battery
const EVERY_S = 3.2; // a new pulse starts this often
const LIFE_S = 7;
const SPEED = 90; // px per second
const BAND = 46; // width of the pulse ring, px

type Pulse = { x: number; y: number; born: number };

/** Dot grid behind the page, with slow rings pulsing out from random points. */
export default function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 0, h = 0, raf = 0, last = 0, nextPulse = 0;
    let pulses: Pulse[] = [];

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (let y = SPACING / 2; y < h; y += SPACING) {
        for (let x = SPACING / 2; x < w; x += SPACING) {
          let glow = 0;
          for (const p of pulses) {
            const age = t - p.born;
            const off = (Math.hypot(x - p.x, y - p.y) - age * SPEED) / BAND;
            if (Math.abs(off) < 2) glow += Math.exp(-off * off) * (1 - age / LIFE_S);
          }
          glow = Math.min(glow, 1);
          const size = glow > 0.35 ? 2 : 1;
          ctx.fillStyle = `rgba(17,17,17,${(0.24 + glow * 0.6).toFixed(2)})`;
          ctx.fillRect(Math.round(x), Math.round(y), size, size);
        }
      }
    };

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now() / 1000);
    };
    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      if (ms - last < 1000 / FPS) return;
      last = ms;
      const t = ms / 1000;
      if (t >= nextPulse) {
        pulses.push({ x: Math.random() * w, y: Math.random() * h, born: t });
        nextPulse = t + EVERY_S;
      }
      pulses = pulses.filter((p) => t - p.born < LIFE_S);
      draw(t);
    };

    resize();
    window.addEventListener('resize', resize);
    if (!still) raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} className="dotfield" aria-hidden="true" />;
}
