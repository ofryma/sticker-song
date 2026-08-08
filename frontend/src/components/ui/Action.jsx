import { Button } from "@heroui/react";
import { Link } from "react-router-dom";

/* HeroUI's ripple pops; this tone needs a slow colour shift instead. */
const SHARED = "font-sans tracking-wide transition-all duration-700 ease-calm";

const TONES = {
  primary: { color: "primary", variant: "solid", className: "" },
  ghost: {
    color: "default",
    variant: "bordered",
    className: "border-day-line text-ink-soft hover:border-ink/30 hover:text-ink",
  },
  quiet: { color: "default", variant: "light", className: "text-ink-muted hover:text-ink" },
  /* The remembering gesture, and anything already given or chosen. */
  leaf: {
    color: "success",
    variant: "bordered",
    className: "border-olive/45 text-olive-deep hover:border-olive/80 hover:bg-olive-pale/70",
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
