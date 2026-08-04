import { useEffect, useState } from "react";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";
import { Link, NavLink } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";
import { Candle } from "./Candle.jsx";
import { Action } from "./ui/Action.jsx";

const LINKS = [
  { to: "/", key: "nav.home", end: true },
  { to: "/wall", key: "nav.wall" },
  { to: "/about", key: "nav.about" },
];

function navClass({ isActive }) {
  return [
    "relative py-1 text-sm transition-colors duration-700 ease-memorial",
    isActive ? "text-stone-50" : "text-stone-400 hover:text-stone-100",
    // The active underline grows out of the center rather than sliding.
    "after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-flame/60",
    "after:origin-center after:transition-transform after:duration-1200 after:ease-memorial",
    isActive ? "after:scale-x-100" : "after:scale-x-0",
  ].join(" ");
}

/**
 * On a phone this is only an identity bar — the name and the language switch,
 * with navigation handled by <BottomNav>. From `sm` up it grows the full nav.
 */
export function Header() {
  const { t, other, otherName, setLang } = useI18n();
  const [settled, setSettled] = useState(false);

  // Transparent over the hero, stone-dark once the page has been scrolled.
  useEffect(() => {
    const onScroll = () => setSettled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Navbar
      maxWidth="xl"
      height="3.5rem"
      isBlurred
      classNames={{
        base: [
          "border-b transition-all duration-1200 ease-memorial",
          "pt-[env(safe-area-inset-top)] sm:h-16",
          settled ? "bg-night/85 border-night-line/70" : "bg-transparent border-transparent",
        ].join(" "),
        wrapper: "px-4 sm:px-8",
      }}
    >
      <NavbarBrand>
        <Link to="/" className="group flex items-center gap-2.5 sm:gap-3">
          <Candle size={15} className="shrink-0 -translate-y-px" />
          <span className="font-display text-[0.95rem] text-stone-100 transition-colors duration-700 group-hover:text-flame-glow sm:text-lg">
            {t("brand.name")}
          </span>
        </Link>
      </NavbarBrand>

      <NavbarContent className="hidden gap-7 sm:flex" justify="center">
        {LINKS.map((link) => (
          <NavbarItem key={link.to}>
            <NavLink to={link.to} end={link.end} className={navClass}>
              {t(link.key)}
            </NavLink>
          </NavbarItem>
        ))}
      </NavbarContent>

      <NavbarContent justify="end" className="gap-1 sm:gap-2">
        <NavbarItem>
          <Action
            tone="quiet"
            size="sm"
            onPress={() => setLang(other)}
            aria-label={t("nav.language")}
          >
            {otherName}
          </Action>
        </NavbarItem>
        {/* Adding is a bottom-bar tab on mobile, so it only appears here when wide. */}
        <NavbarItem className="hidden sm:flex">
          <Action tone="candle" size="sm" to="/contribute">
            {t("nav.contribute")}
          </Action>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
