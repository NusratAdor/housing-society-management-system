// client/src/components/ArrowSwapIcon.jsx
//
// Reusable circular icon: outline arrow at rest, slides out on hover
// while a filled (gradient background) arrow slides in from the other
// side and stays for as long as hover holds. Reverses automatically on
// hover-end (inherent CSS transition behavior — no extra code needed).
//
// FIX — square-instead-of-circle bug: some browsers (notably Safari/
// WebKit) have a known quirk where a child element with a `transform`
// can visually leak past a parent's `overflow-hidden` + `border-radius`
// clip during the transition frame. `overflow-hidden` + `rounded-full`
// alone were not a reliable enough guarantee. Added `clipPath:
// "circle(50%)"` as a redundant, transform-independent clip — this
// property doesn't have that rendering bug, so the shape is guaranteed
// circular in every browser at every frame of the animation.
//
// MOBILE BEHAVIOR: the swap trigger here (group-hover/icon) is a real
// CSS :hover pseudo-class on a named nested group. Touch devices never
// produce a genuine :hover, so on mobile this always stays in its
// outline (at-rest) state — exactly as requested. Any scroll-triggered
// "appear" fade for the icon as a whole should be handled by the
// PARENT wrapping this component (see GalleryCard.jsx), not by this
// component itself — this component only owns the outline<->fill swap.
//
// Colors are passed in as complete Tailwind class strings so each
// usage (dark card overlay vs. light "View all" button) can use
// context-appropriate colors while sharing one implementation.

import React from "react";
import { ArrowRight } from "lucide-react";

export default function ArrowSwapIcon({
  size           = 36,
  outlineColor   = "text-white/80",
  outlineBorder  = "border-white/30",
  fillGradient   = "bg-gradient-to-r from-emerald-500 to-teal-600",
  fillArrowColor = "text-white",
  className      = "",
}) {
  const arrowSize = Math.round(size * 0.44);

  return (
    <div
      className={`group/icon relative overflow-hidden rounded-full
                  border ${outlineBorder} flex-shrink-0
                  ${className}`}
      style={{ width: size, height: size, clipPath: "circle(50%)" }}
    >
      {/* Outline layer — visible at rest. Exits right on direct hover. */}
      <div
        className="absolute inset-0 flex items-center justify-center
                   transition-transform duration-300 ease-out
                   group-hover/icon:translate-x-full"
      >
        <ArrowRight size={arrowSize} strokeWidth={2} className={outlineColor} />
      </div>

      {/* Filled layer — off-screen left at rest. Slides in on hover and
          STAYS while hover holds; reverses automatically on hover-end. */}
      <div
        className={`absolute inset-0 flex items-center justify-center
                    -translate-x-full ${fillGradient}
                    transition-transform duration-300 ease-out
                    group-hover/icon:translate-x-0`}
      >
        <ArrowRight size={arrowSize} strokeWidth={2} className={fillArrowColor} />
      </div>
    </div>
  );
}