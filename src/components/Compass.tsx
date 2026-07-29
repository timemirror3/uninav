import { useEffect, useState } from 'react';

interface Props {
  /** Base bearing for the current route, in degrees. */
  bearing: number;
  /** Section name shown after the degrees, e.g. "SERVICES". */
  label: string;
}

/**
 * The header bearing indicator. A real design element, not prototype scaffolding.
 *
 * Ported from the prototype verbatim:
 *   deg = (bearing + min(40, scrollY / 30)) % 360
 *   text = String(round(deg)).padStart(3, '0') + '° · ' + label
 *
 * The scroll listener is rAF-throttled and passive, exactly as the prototype had
 * it, so scrolling never blocks on a layout read.
 */
export default function Compass({ bearing, label }: Props) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let frame: number | null = null;

    const onScroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setScrollY(window.scrollY);
      });
    };

    // Seed from the current position: a reload partway down the page should not
    // start the needle at zero.
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  const deg = (bearing + Math.min(40, scrollY / 30)) % 360;
  const text = `${String(Math.round(deg)).padStart(3, '0')}° · ${label}`;

  return (
    <div
      className="hidden items-center gap-2 text-gold-dark lg:flex"
      style={{ font: "600 11px 'Public Sans'", letterSpacing: '.14em' }}
      title="Bearing indicator — rotates with scroll"
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        style={{ overflow: 'visible' }}
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="13" cy="13" r="12" fill="none" stroke="#D8A13A" strokeWidth="1" />
        <line x1="13" y1="1" x2="13" y2="4" stroke="#D8A13A" strokeWidth="1" />
        <line x1="13" y1="22" x2="13" y2="25" stroke="#D8A13A" strokeWidth="1" />
        <line x1="1" y1="13" x2="4" y2="13" stroke="#D8A13A" strokeWidth="1" />
        <line x1="22" y1="13" x2="25" y2="13" stroke="#D8A13A" strokeWidth="1" />
        <g
          style={{
            transform: `rotate(${deg}deg)`,
            transformOrigin: '13px 13px',
            transition: 'transform .3s cubic-bezier(.22,1,.36,1)',
          }}
        >
          <polygon points="13,4.5 15,13 13,21.5 11,13" fill="#560F10" />
          <circle cx="13" cy="13" r="1.6" fill="#D8A13A" />
        </g>
      </svg>
      {/* min-width prevents the header reflowing as the digits change. */}
      <span style={{ minWidth: '110px' }}>{text}</span>
    </div>
  );
}
