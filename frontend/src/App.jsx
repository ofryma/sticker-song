import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { useI18n } from "./i18n/index.jsx";
import { Header } from "./components/Header.jsx";
import { Footer } from "./components/Footer.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { Loading } from "./components/States.jsx";
import Home from "./pages/Home.jsx";

// Split so a visitor who only reads the wall never downloads the upload wizard.
const Wall = lazy(() => import("./pages/Wall.jsx"));
const Contribute = lazy(() => import("./pages/Contribute.jsx"));
const About = lazy(() => import("./pages/About.jsx"));

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

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-night-raised focus:px-4 focus:py-2 focus:text-sm"
      >
        {t("nav.skip")}
      </a>

      <ScrollToTop />
      <Header />

      <main id="main">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/wall" element={<Wall />} />
            <Route path="/contribute" element={<Contribute />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>

      <Footer />
      <BottomNav />
    </>
  );
}
