import { useEffect, useRef, useState, type ReactNode } from 'react';
import { geoOrthographic, geoPath, geoGraticule10, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeoPermissibleObjects } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import landUrl from '../assets/land-110m.json?url';
import { DESTINATIONS, type Destination } from '../lib/destinations';

interface Props {
  landColor?: string;
  oceanColor?: string;
  spin?: boolean;
  /**
   * Fallback content — the dotted route diagram, slotted in from Astro. It is
   * rendered server-side, so it is what no-JS visitors see, and it is what we
   * fall back to if WebGL-less canvas, the land data, or reduced-motion rules
   * this out.
   */
  children?: ReactNode;
}

type Phase = 'pending' | 'live' | 'fallback';

/**
 * Interactive orthographic globe for the home hero.
 *
 * Ported from the Claude Design prototype, with three changes forced by this
 * codebase:
 *
 *  1. d3-geo, topojson-client and the land topology are bundled/served locally.
 *     The prototype pulled all three from jsDelivr, which the strict CSP in
 *     public/_headers blocks outright (`script-src 'self' …`, `connect-src
 *     'self' …`).
 *  2. Marker positions are mutated on the DOM inside the rAF loop rather than
 *     held in React state — 25 markers re-rendering every frame would be
 *     unusable.
 *  3. `prefers-reduced-motion` keeps the globe but removes the motion — no
 *     fly-in, no fade, no auto-spin. Still draggable.
 *
 * The slotted route diagram remains the fallback for no-JS and no-canvas.
 */
export default function Globe({
  landColor = '#560F10',
  oceanColor = '#EFDCAE',
  spin = true,
  children,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>('pending');
  const [active, setActive] = useState<Destination | null>(null);
  const [hovered, setHovered] = useState<Destination | null>(null);
  // True once the intro animation has finished; gates the markers.
  const [settled, setSettled] = useState(false);
  /*
   * Intro start time lives in a ref, not effect scope. If the effect re-runs for
   * any reason, effect-scoped timing restarts from zero every time — which left
   * globalAlpha pinned near 0 and the globe invisible. Anchoring it to the
   * component means the intro runs exactly once.
   */
  const introStartRef = useRef<number | null>(null);

  // Mirror interaction state into refs so the rAF loop reads it without
  // re-subscribing every render.
  const activeRef = useRef<Destination | null>(null);
  const hoveredRef = useRef<Destination | null>(null);
  activeRef.current = active;
  hoveredRef.current = hovered;

  useEffect(() => {
    /*
     * Reduced motion keeps the globe but removes the motion: no fly-in, no
     * fade, no auto-spin. Dropping to the static route entirely was too blunt —
     * "reduce motion" is not "remove content", and it meant anyone with the OS
     * setting on (it is the default on plenty of managed Windows builds) never
     * saw the hero at all. It stays fully draggable.
     */
    const introSkipped =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setPhase('fallback');
      return;
    }

    let dead = false;
    let frame = 0;
    let resizeObserver: ResizeObserver | undefined;

    /*
     * Everything needed to paint runs SYNCHRONOUSLY. The land topology is
     * fetched afterwards and drops in when it arrives.
     *
     * This used to sit behind `await fetch(landUrl)`, which meant the canvas was
     * not even sized until the network came back — and if the effect was torn
     * down during that await, `dead` short-circuited the rest and the globe
     * never started at all. In production it never started: the canvas stayed at
     * its default 300x150, unpainted, while the 25 markers (rendered
     * unconditionally) floated over the fallback route diagram. That is the
     * "globe isn't showing" everyone saw.
     *
     * A sphere and graticule are a perfectly legible globe on their own, so
     * there is no reason to block first paint on a 55KB download.
     */
    let land: GeoPermissibleObjects | null = null;

    const graticule = geoGraticule10();
    const projection = geoOrthographic().precision(0.2);
    const path = geoPath(projection, ctx);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let rotation: [number, number] = [-20, -12];
    let width = 0;
    let height = 0;

    /*
     * Intro: the globe arrives from far away and settles.
     *
     * Scale eases from 0.62x to full on an ease-out-cubic while the sphere fades
     * up and spins a little faster than its resting drift, so it decelerates
     * into place rather than snapping on. Radius is recomputed every frame from
     * `baseRadius`, which the ResizeObserver keeps current — so a resize
     * mid-intro does not fight the animation.
     */
    // Reduced motion: no fly-in, no fade — the globe is simply there.
    const introMs = introSkipped ? 0 : 1400;
    if (introStartRef.current === null) introStartRef.current = performance.now();
    const introStart = introStartRef.current;
    let baseRadius = 0;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseRadius = Math.min(width, height) * 0.46;
      projection.translate([width / 2, height / 2]).scale(baseRadius);
    };
    resize();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    let dragging = false;
    let last: [number, number] = [0, 0];

    const onPointerDown = (event: PointerEvent) => {
      if (event.target !== canvas) return;
      dragging = true;
      last = [event.clientX, event.clientY];
      host.style.cursor = 'grabbing';
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const k = 0.22;
      rotation = [
        rotation[0] + (event.clientX - last[0]) * k,
        Math.max(-70, Math.min(70, rotation[1] - (event.clientY - last[1]) * k)),
      ];
      last = [event.clientX, event.clientY];
    };
    const endDrag = () => {
      dragging = false;
      host.style.cursor = 'grab';
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    setPhase('live');
    // Markers appear once the globe has settled, so they do not fly across the
    // canvas while it is still scaling in.
    const settleTimer = setTimeout(() => setSettled(true), introMs);

    const draw = () => {
      if (dead) return;
      frame = requestAnimationFrame(draw);

      // Intro progress: 0 → 1 over INTRO_MS, then pinned at 1 forever.
      const intro = introMs === 0 ? 1 : Math.min(1, (performance.now() - introStart) / introMs);
      const eased = easeOutCubic(intro);

      const paused = dragging || hoveredRef.current !== null || activeRef.current !== null;
      // Spin fast on arrival and decelerate into the resting drift.
      const driftSpeed = 0.055 + (1 - eased) * 0.5;
      if (spin && !paused && !introSkipped) rotation[0] += driftSpeed;
      projection.rotate(rotation);
      projection.scale(baseRadius * (0.62 + 0.38 * eased));

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = eased;

      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.fillStyle = oceanColor;
      ctx.fill();

      ctx.beginPath();
      path(graticule);
      ctx.strokeStyle = 'rgba(86,15,16,.14)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (land) {
        ctx.beginPath();
        path(land);
        ctx.fillStyle = landColor;
        ctx.fill();
      }

      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.strokeStyle = '#D8A13A';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.globalAlpha = 1;

      const centre: [number, number] = [-rotation[0], -rotation[1]];
      DESTINATIONS.forEach((destination, index) => {
        const node = markerRefs.current[index];
        if (!node) return;
        const point = projection(destination.coord);
        // Beyond a quarter turn the marker is on the far side of the sphere.
        const onFace =
          !!point && geoDistance(destination.coord, centre) < Math.PI / 2 - 0.02;

        node.style.opacity = onFace ? '1' : '0';
        node.style.pointerEvents = onFace ? 'auto' : 'none';
        // Keep hidden markers out of the tab order.
        node.tabIndex = onFace ? 0 : -1;
        node.setAttribute('aria-hidden', onFace ? 'false' : 'true');
        if (!point) return;
        node.style.left = `${point[0]}px`;
        node.style.top = `${point[1]}px`;

        if (hoveredRef.current === destination && tooltipRef.current) {
          tooltipRef.current.style.left = `${point[0]}px`;
          tooltipRef.current.style.top = `${point[1] - 32}px`;
        }
        if (activeRef.current === destination && cardRef.current) {
          cardRef.current.style.left = `${Math.max(0, Math.min(point[0] + 16, width - 290))}px`;
          cardRef.current.style.top = `${point[1] + 8}px`;
        }
      });
    };
    draw();

      // Land arrives late and simply starts being drawn. A failure here leaves a
      // sphere-and-graticule globe, which is still legible.
      fetch(landUrl)
        .then((r) => r.json())
        .then((raw) => {
          if (dead) return;
          const topo = raw as Topology<{ land: GeometryCollection }>;
          land = feature(topo, topo.objects.land) as unknown as GeoPermissibleObjects;
        })
      .catch(() => {});

    return () => {
      dead = true;
      clearTimeout(settleTimer);
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [landColor, oceanColor, spin]);

  // Dismiss the info card on outside click or Escape.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (cardRef.current?.contains(target)) return;
      if (hostRef.current?.contains(target)) return;
      setActive(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [active]);

  if (phase === 'fallback') return <>{children}</>;

  return (
    <div className="relative w-full">
      <div
        ref={hostRef}
        className="relative aspect-[680/470] w-full cursor-grab touch-pan-y"
      >
        {/* The slotted route diagram stays mounted until the globe paints, so
            there is no blank frame and no layout shift when it swaps in. */}
        {phase === 'pending' && <div className="absolute inset-0">{children}</div>}

        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />

        {/* Markers only exist once the globe is actually painting. Rendering
            them during `pending` put 25 pins on top of the fallback route
            diagram, which is what the broken state looked like. */}
        <ul className="contents list-none">
          {phase === 'live' &&
            settled &&
            DESTINATIONS.map((destination, index) => (
            <li key={destination.name} className="contents">
              <button
                ref={(el) => {
                  markerRefs.current[index] = el;
                }}
                type="button"
                onMouseEnter={() => setHovered(destination)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(destination)}
                onBlur={() => setHovered(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(destination);
                  setHovered(null);
                }}
                className="absolute z-2 -translate-x-1/2 -translate-y-[92%] cursor-pointer border-none bg-transparent p-0 opacity-0"
                /* 24x30 is the WCAG 2.2 target-size floor (24x24); anything
                   smaller fails the audit even though the pin art is narrower. */
                style={{ width: 24, height: 30 }}
              >
                {/* Brand-palette pin, drawn inline rather than shipping the
                    prototype's raster marker: one fewer request, crisp at any
                    DPR, and it matches the crest's maroon/gold. */}
                <svg viewBox="0 0 22 28" width="24" height="30" aria-hidden="true">
                  <path
                    d="M11 27C11 27 20.5 16.8 20.5 10.5A9.5 9.5 0 0 0 1.5 10.5C1.5 16.8 11 27 11 27Z"
                    fill="#560F10"
                    stroke="#D8A13A"
                    strokeWidth="1.4"
                  />
                  <circle cx="11" cy="10.4" r="3.4" fill="#D8A13A" />
                </svg>
                <span className="sr-only">{destination.name}</span>
              </button>
            </li>
            ))}
        </ul>

        {/* Hover label */}
        <div
          ref={tooltipRef}
          role="presentation"
          className="pointer-events-none absolute z-3 -translate-x-1/2 -translate-y-full rounded-[3px] bg-maroon px-2.5 py-[5px] whitespace-nowrap text-cream"
          style={{
            display: hovered && !active ? 'block' : 'none',
            font: "600 11px 'Public Sans'",
            letterSpacing: '.08em',
          }}
        >
          {hovered?.name}
        </div>

        {/* Detail card */}
        <div
          ref={cardRef}
          role="dialog"
          aria-label={active ? `About ${active.name}` : undefined}
          className="absolute z-4 max-w-[280px] rounded-[6px] border border-rule bg-white px-[18px] py-4 shadow-[0_12px_40px_rgba(56,9,13,.18)]"
          style={{ display: active ? 'block' : 'none' }}
        >
          <div className="eyebrow mb-1.5">Destination</div>
          <div className="mb-2 font-serif text-[20px] leading-tight text-maroon">
            {active?.name}
          </div>
          <p className="m-0 text-[13.5px] leading-[1.55] text-ink-soft">{active?.info}</p>
          <button
            type="button"
            onClick={() => setActive(null)}
            className="mt-3 cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-maroon underline"
          >
            Close
          </button>
        </div>
      </div>

      <p className="eyebrow mt-1.5" style={{ fontSize: '10px', letterSpacing: '.12em' }}>
        Drag to rotate · {DESTINATIONS.length} destinations plotted
      </p>
      {/*
        Same reason the campus tiles carry a disclaimer, and more pressing here:
        naming 25 selective universities on an admissions consultancy's home page
        invites exactly the inference the Scope of Services policy disclaims.
      */}
      <p className="mt-1.5 max-w-[54ch] text-[12px] text-ink-muted">
        Institutions shown are illustrative of where students apply — not a claim of
        affiliation, placement, or admission.
      </p>
    </div>
  );
}
