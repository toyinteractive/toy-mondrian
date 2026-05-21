const CONFETTI_COLORS = ['#e70503', '#0300ad', '#fdde06', '#ffffff', '#111111'] as const;
const PARTICLE_COUNT = 100;
const DURATION_MS = 3200;
const GRAVITY = 0.35;
const DRAG = 0.992;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
};

export type ConfettiController = {
  burst: () => void;
  stop: () => void;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createParticle(width: number): Particle {
  const size = randomBetween(6, 14);
  return {
    x: randomBetween(0, width),
    y: randomBetween(-80, -8),
    vx: randomBetween(-4.5, 4.5),
    vy: randomBetween(2, 9),
    w: size,
    h: size * randomBetween(0.55, 1.35),
    rotation: randomBetween(0, Math.PI * 2),
    rotationSpeed: randomBetween(-0.18, 0.18),
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ?? CONFETTI_COLORS[0],
  };
}

export function createConfettiOverlay(host: HTMLElement): ConfettiController {
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let particles: Particle[] = [];
  let rafId = 0;
  let startedAt = 0;
  let running = false;

  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const stop = (): void => {
    running = false;
    particles = [];
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    canvas.classList.remove('confetti-canvas--active');
  };

  const tick = (now: number): void => {
    if (!running || !ctx) {
      return;
    }

    const elapsed = now - startedAt;
    if (elapsed >= DURATION_MS) {
      stop();
      return;
    }

    const fade = elapsed > DURATION_MS - 700 ? (DURATION_MS - elapsed) / 700 : 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    ctx.clearRect(0, 0, width, height);

    for (const particle of particles) {
      particle.vy += GRAVITY;
      particle.vx *= DRAG;
      particle.vy *= DRAG;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;

      if (particle.y > height + 40) {
        continue;
      }

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.w * 0.5, -particle.h * 0.5, particle.w, particle.h);
      ctx.restore();
    }

    rafId = requestAnimationFrame(tick);
  };

  const burst = (): void => {
    if (reducedMotion || !ctx) {
      return;
    }

    stop();
    resize();
    particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle(window.innerWidth));
    running = true;
    startedAt = performance.now();
    canvas.classList.add('confetti-canvas--active');
    rafId = requestAnimationFrame(tick);
  };

  resize();
  window.addEventListener('resize', resize);

  return {
    burst,
    stop,
  };
}
