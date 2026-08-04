import { Button } from "@heroui/react";
import { Link } from "react-router-dom";

/* HeroUI's ripple pops; the memorial tone needs a slow colour shift instead. */
const SHARED = "font-sans tracking-wide transition-all duration-700 ease-memorial";

const TONES = {
  primary: { color: "primary", variant: "solid", className: "" },
  ghost: {
    color: "default",
    variant: "bordered",
    className: "border-night-line text-stone-300 hover:border-stone-300/60 hover:text-stone-50",
  },
  quiet: { color: "default", variant: "light", className: "text-stone-400 hover:text-stone-100" },
  candle: {
    color: "warning",
    variant: "bordered",
    className: "border-flame/35 text-flame hover:border-flame/70 hover:bg-flame/10",
  },
};

/**
 * The single button in the app. Everything else — pages, wizard, modals — goes
 * through here, so tone, radius and timing can only be changed in one place.
 * Pass `to` for internal navigation, `href` for outside links.
 */
export function Action({ tone = "primary", to, href, className = "", children, ...rest }) {
  const preset = TONES[tone] ?? TONES.primary;
  const routing = to ? { as: Link, to } : href ? { as: "a", href } : {};

  return (
    <Button
      {...routing}
      color={preset.color}
      variant={preset.variant}
      radius="sm"
      disableRipple
      className={`${SHARED} ${preset.className} ${className}`}
      {...rest}
    >
      {children}
    </Button>
  );
}
