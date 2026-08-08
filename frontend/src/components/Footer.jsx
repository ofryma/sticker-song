import { Link } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";

// The archive is AGPL-3.0, and section 13 obliges a network service to offer
// its source to the people using it. This link is that offer.
export const SOURCE_URL = "https://github.com/ofryma/sticker-song";

export function Footer({ className = "" }) {
  const { t } = useI18n();

  return (
    <footer className={`mt-32 border-t border-day-line/60 py-14 ${className}`}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 text-center sm:px-8">
        <p className="font-display text-xl tracking-wide text-ink">{t("footer.line")}</p>
        <hr className="rule-fade max-w-xs" />
        <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{t("footer.built")}</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-muted">
          <Link to="/wall" className="transition-colors duration-700 hover:text-ink">
            {t("nav.wall")}
          </Link>
          <Link to="/contribute" className="transition-colors duration-700 hover:text-ink">
            {t("nav.contribute")}
          </Link>
          <Link to="/about" className="transition-colors duration-700 hover:text-ink">
            {t("nav.about")}
          </Link>
          <Link to="/contact" className="transition-colors duration-700 hover:text-ink">
            {t("nav.contact")}
          </Link>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors duration-700 hover:text-ink"
          >
            {t("footer.source")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
