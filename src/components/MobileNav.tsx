import { useEffect, useRef, useState } from 'react';

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  links: NavLink[];
  crestSrc: string;
  email: string;
  phone: string;
}

/**
 * Full-screen mobile navigation overlay, ported from the prototype's
 * `menuOpen` state.
 *
 * The prototype rendered the overlay but had no focus management (it was a
 * mockup). A real overlay has to trap focus, close on Escape, restore focus to
 * the trigger, and lock body scroll — otherwise keyboard and screen-reader users
 * end up navigating the page behind it.
 */
export default function MobileNav({ links, crestSrc, email, phone }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        ) ?? []
      );

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      (triggerRef.current ?? previouslyFocused)?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open menu"
        className="flex cursor-pointer flex-col gap-[4px] rounded-[4px] border border-[rgba(86,15,16,.2)] bg-transparent p-[9px_10px] hover:border-gold lg:hidden"
      >
        <span className="block h-[2px] w-[18px] bg-maroon" />
        <span className="block h-[2px] w-[18px] bg-maroon" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="fixed inset-0 z-100 flex flex-col bg-maroon-deep px-8 py-7"
        >
          <div className="flex items-center justify-between">
            <img
              src={crestSrc}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-full"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-[4px] border border-[rgba(216,161,58,.5)] bg-transparent px-4 py-2.5 text-[13px] font-semibold text-cream hover:border-gold hover:text-bg"
            >
              Close ✕
            </button>
          </div>

          <nav className="mt-16 flex flex-col gap-2">
            {links.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                className="motion-safe:animate-[rise_.4s_cubic-bezier(.22,1,.36,1)_both] border-b border-[rgba(216,161,58,.25)] py-2.5 font-serif text-[clamp(30px,9vw,44px)] text-bg no-underline hover:text-gold"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/book"
              className="motion-safe:animate-[rise_.4s_cubic-bezier(.22,1,.36,1)_both] py-2.5 font-serif text-[clamp(30px,9vw,44px)] text-gold no-underline hover:text-gold-hover"
              style={{ animationDelay: `${links.length * 0.06}s` }}
            >
              Book a consultation →
            </a>
          </nav>

          <div
            className="mt-auto text-cream-muted"
            style={{ font: "600 11px 'Public Sans'", letterSpacing: '.14em' }}
          >
            <a href={`mailto:${email}`} className="text-cream-muted no-underline hover:text-cream">
              {email.toUpperCase()}
            </a>
            {' · '}
            <a
              href={`tel:+1${phone.replace(/\D/g, '')}`}
              className="text-cream-muted no-underline hover:text-cream"
            >
              {phone}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
