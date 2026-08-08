import { Component } from "react";
import { useI18n } from "../i18n/index.jsx";
import { Action } from "./ui/Action.jsx";

/** The fallback is its own function so it can read the dictionary through the hook. */
function Crashed({ onRetry }) {
  const { t } = useI18n();
  return (
    <div className="card-stone mx-auto my-20 max-w-md px-8 py-10 text-center animate-fade">
      <p className="text-ink">{t("common.crashed")}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("common.crashedLead")}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Action tone="ghost" onPress={onRetry}>
          {t("common.retry")}
        </Action>
        <Action tone="quiet" to="/">
          {t("common.backHome")}
        </Action>
      </div>
    </div>
  );
}

/**
 * Catches a render crash anywhere below it so the page keeps its shell instead
 * of going blank. Give it a `resetKey` (the pathname) and it clears itself on
 * navigation, so one broken route does not stick to the next one.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error("Render failed:", error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return <Crashed onRetry={this.reset} />;
    return this.props.children;
  }
}
