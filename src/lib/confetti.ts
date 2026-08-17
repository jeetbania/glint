// Adapted from transitions.dev's "like button" particle-burst pattern
// (per-particle CSS custom properties driving a shared @keyframes,
// see globals.css's .confetti-particle) — generalized from 8 same-color
// dots to ~18 multi-hue ones for a genuine "celebration" read, and made
// imperative/one-shot (creates its own particle container, animates,
// then removes itself) instead of living on a persistent toggle button,
// since a kanban card moving to Done is a one-time event, not a state.
const HUES = [8, 48, 100, 165, 225, 280] as const;

export function triggerConfetti(x: number, y: number) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;pointer-events:none;z-index:9999;`;
  document.body.appendChild(container);

  const count = 18;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("i");
    particle.className = "confetti-particle";
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 40 + Math.random() * 50;
    const hue = HUES[i % HUES.length];
    particle.style.setProperty("--px", `${Math.cos(angle) * dist}px`);
    particle.style.setProperty("--py", `${Math.sin(angle) * dist - 20}px`);
    particle.style.setProperty("--pdur", `${550 + Math.random() * 300}ms`);
    particle.style.setProperty("--pdelay", `${Math.random() * 80}ms`);
    particle.style.setProperty("--psize", `${0.7 + Math.random() * 0.8}`);
    particle.style.setProperty("--phue", String(hue));
    container.appendChild(particle);
  }

  setTimeout(() => container.remove(), 1200);
}
