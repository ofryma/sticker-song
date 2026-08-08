import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { useI18n } from "./i18n/index.jsx";
import { Header } from "./components/Header.jsx";
import { Footer } from "./components/Footer.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { Loading } from "./components/States.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { A11yButton } from "./components/a11y/A11yButton.jsx";
import Home from "./pages/Home.jsx";

// Split so a visitor who only reads the wall never downloads the upload wizard.
const Wall = lazy(() => import("./pages/Wall.jsx"));
const Contribute = lazy(() => import("./pages/Contribute.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
// The review queue: not linked from anywhere, and no visitor downloads it.
const Admin = lazy(() => import("./pages/Admin.jsx"));

/* On a phone the wizard owns the bottom of the screen — its actions are pinned
   there, above the nav bar — so a footer underneath them is only something to
   scroll past. Wide screens have the room and keep it. */
const NO_FOOTER_ON_PHONE = ["/contribute"];

/** Every navigation starts at the top of the page, without a smooth scroll. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

export default function App() {
  const { t } = useI18n();
  const { pathname } = useLocation();

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-day-warm focus:px-4 focus:py-2 focus:text-sm"
      >
        {t("nav.skip")}
      </a>

      <ScrollToTop />
      <Header />

      <main id="main">
        {/* Keyed on the path: a crashed route clears itself when you navigate away. */}
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/wall" element={<Wall />} />
              <Route path="/contribute" element={<Contribute />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer className={NO_FOOTER_ON_PHONE.includes(pathname) ? "hidden sm:block" : ""} />
      <BottomNav />
      <A11yButton />
    </>
  );
}
