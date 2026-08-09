import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";

/* Simple line icons, sized for a thumb rather than a cursor. */
const ICONS = {
  home: "M4 11.2 12 4l8 7.2V20h-5.5v-5.4h-5V20H4z",
  wall: "M4 5h7v6H4zM13 5h7v4h-7zM4 13h5v6H4zM11 11h9v8h-9z",
  add: "M12 5v14M5 12h14",
  about: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 10v7M12 7.2v.2",
};

/* Every tab reads the same. Adding a sticker used to be tinted olive whether or
   not it was the page you were on, which made the nav look as though it were
   answering a question nobody had asked; olive means chosen here, and the active
   mark already says which page that is. */
const TABS = [
  { to: "/", key: "nav.home", icon: "home", end: true },
  { to: "/wall", key: "nav.wall", icon: "wall" },
  { to: "/contribute", key: "nav.contribute", icon: "add" },
  { to: "/about", key: "nav.about", icon: "about" },
];

/**
 * Mobile navigation. A fixed bar within thumb reach; the desktop keeps its
 * header nav instead and this is hidden from `sm` up.
 */
export function BottomNav() {
  const { t } = useI18n();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-day-line/80 bg-day/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] sm:hidden"
      aria-label={t("nav.wall")}
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  "flex min-h-[3.75rem] flex-col items-center justify-center gap-1.5 px-1 py-2",
                  "transition-colors duration-700 ease-calm",
                  isActive ? "text-ink" : "text-ink-muted",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <svg viewBox="0 0 24 24" className="h-[1.35rem] w-[1.35rem]" fill="none">
                      <path
                        d={ICONS[tab.icon]}
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {/* The active dot fades in rather than sliding between tabs. */}
                    <span
                      className={[
                        "absolute -top-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-olive",
                        "transition-opacity duration-1200 ease-calm",
                        isActive ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                    />
                  </span>
                  <span className="text-[0.63rem] leading-none">{t(tab.key)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
