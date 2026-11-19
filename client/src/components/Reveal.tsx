import { useEffect, useRef, type ReactNode } from "react";

// Scroll-reveal wrapper: content rises softly into view the first time it
// enters the viewport. CSS keeps the hidden state inside the
// prefers-reduced-motion: no-preference block, so reduced-motion users and
// no-JS renders always see the content. A timeout guarantees nothing can
// stay hidden if IntersectionObserver never fires.
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.classList.add("is-visible");
    if (!("IntersectionObserver" in window)) {
      show();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            show();
            io.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    const fallback = setTimeout(show, 1600);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
