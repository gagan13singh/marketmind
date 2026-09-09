"use client";

import { useEffect, useRef } from "react";

/**
 * Animated landing background.
 *
 * Rather than the usual floating orbs or particle mesh, this renders a field of
 * slow-drifting price lines — the actual subject matter of the product. Each
 * line is a seeded random walk with its own drift, so the field reads as a
 * market rather than as decoration.
 *
 * Performance and accessibility:
 *  - Renders to a single canvas, capped at 45fps.
 *  - Pauses entirely when the tab is hidden or the element scrolls out of view.
 *  - Draws one static frame and stops if the user prefers reduced motion.
 */

interface Line {
  points: number[];
  offset: number;
  speed: number;
  amplitude: number;
  baseline: number;
  opacity: number;
  rising: boolean;
}

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export function MarketField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const canvas: HTMLCanvasElement = el;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rng = makeRng(20260908);

    let width = 0;
    let height = 0;
    let dpr = 1;
    let lines: Line[] = [];

    function buildLines(): void {
      const count = width < 640 ? 5 : width < 1024 ? 7 : 9;
      const pointCount = Math.ceil(width / 14) + 40;
      lines = [];

      for (let i = 0; i < count; i += 1) {
        const points: number[] = [];
        let value = 0;
        const drift = (rng() - 0.42) * 0.5;
        for (let p = 0; p < pointCount; p += 1) {
          value += drift + (rng() - 0.5) * 6;
          points.push(value);
        }
        // Normalise so every line occupies a similar visual band.
        const min = Math.min(...points);
        const max = Math.max(...points);
        const span = max - min || 1;
        const normalised = points.map((v) => (v - min) / span);

        lines.push({
          points: normalised,
          offset: rng() * pointCount,
          speed: 0.06 + rng() * 0.16,
          amplitude: (0.08 + rng() * 0.16) * height,
          baseline: (0.12 + (i / count) * 0.78) * height,
          opacity: 0.05 + rng() * 0.14,
          rising: normalised[normalised.length - 1] > normalised[0],
        });
      }
    }

    function resize(): void {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildLines();
    }

    function draw(): void {
      ctx.clearRect(0, 0, width, height);

      for (const line of lines) {
        const step = 14;
        const visiblePoints = Math.ceil(width / step) + 2;

        ctx.beginPath();
        for (let i = 0; i < visiblePoints; i += 1) {
          const index = Math.floor(line.offset + i) % line.points.length;
          const value = line.points[index];
          const x = i * step;
          const y = line.baseline - value * line.amplitude;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        // Jade for lines trending up, clay for down — consistent with the
        // product's data encoding rather than arbitrary decoration.
        const colour = line.rising ? "63, 182, 139" : "226, 99, 90";
        ctx.strokeStyle = `rgba(${colour}, ${line.opacity})`;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    }

    let frame = 0;
    let last = 0;
    const FRAME_MS = 1000 / 45;

    function tick(now: number): void {
      frame = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      for (const line of lines) line.offset += line.speed;
      draw();
    }

    resize();

    if (reducedMotion) {
      draw();
    } else {
      frame = requestAnimationFrame(tick);
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    // Stop drawing when the tab is not visible.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
      } else if (!reducedMotion) {
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* Vignette keeps the field behind the text rather than competing with it. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 20%, var(--color-ink-900) 78%), linear-gradient(180deg, transparent 60%, var(--color-ink-900) 100%)",
        }}
      />
    </div>
  );
}
