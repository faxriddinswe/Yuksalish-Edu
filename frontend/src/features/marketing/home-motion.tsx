"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function HomeMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!container || preference.matches || !("IntersectionObserver" in window))
      return;
    const targets = container.querySelectorAll<HTMLElement>(
      ".hero-copy, .hero-art, .value-grid > div, .section-heading, .card-grid > *, .about-grid > *, .results-band > .container, .faq-grid > *, .cta",
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-motion", "shown");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
    );
    targets.forEach((target, index) => {
      target.style.setProperty(
        "--motion-delay",
        `${Math.min(index % 3, 2) * 65}ms`,
      );
      target.setAttribute("data-motion", "waiting");
      observer.observe(target);
    });
    function reduceMotion() {
      if (preference.matches) {
        observer.disconnect();
        targets.forEach((target) => target.removeAttribute("data-motion"));
      }
    }
    preference.addEventListener("change", reduceMotion);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", reduceMotion);
      targets.forEach((target) => target.removeAttribute("data-motion"));
    };
  }, []);
  return (
    <div ref={root} className="marketing-home">
      {children}
    </div>
  );
}
