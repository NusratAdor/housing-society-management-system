// client/src/hooks/useScrollActive.js
//
// Simulates ":hover" on touch devices by watching scroll position.
//
// WHY this exists: touch devices have no real hover state. On desktop,
// CSS :hover / Tailwind's group-hover: naturally drive the gallery card
// animations. On mobile, nothing ever triggers them without this.
//
// HOW it works:
//   1. Checks matchMedia('(hover: hover) and (pointer: fine)') ONCE on
//      mount. If the device DOES support real hover (desktop/trackpad),
//      this hook does nothing at all — it stays completely inert so it
//      can never interfere with normal :hover behavior there.
//   2. If the device does NOT support real hover (touch/mobile), it
//      attaches an IntersectionObserver to the returned ref. When the
//      element crosses the given visibility threshold while scrolling
//      (default 50% visible), `isActive` flips to true — mimicking
//      "hover started". When it scrolls back out of that range (up or
//      down), `isActive` flips back to false — mimicking "hover ended".
//
// USAGE:
//   const [cardRef, isActive] = useScrollActive();
//   <div ref={cardRef} data-active={isActive} className="group ...">

import { useEffect, useRef, useState } from "react";

export default function useScrollActive(threshold = 0.5) {
  const ref = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const supportsRealHover = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;

    // Desktop / trackpad — do nothing. Normal CSS :hover handles it.
    if (supportsRealHover) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsActive(entry.isIntersecting),
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isActive];
}