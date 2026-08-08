import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useHref, useNavigate } from "react-router-dom";
import { HeroUIProvider } from "@heroui/react";
import { I18nProvider } from "./i18n/index.jsx";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import "./index.css";

/** HeroUI needs the router's navigate so its links behave like <Link>. */
function Providers({ children }) {
  const navigate = useNavigate();
  return (
    <HeroUIProvider navigate={navigate} useHref={useHref}>
      {children}
    </HeroUIProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Providers>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </Providers>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
);
