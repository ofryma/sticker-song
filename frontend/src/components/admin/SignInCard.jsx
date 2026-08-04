import { useState } from "react";
import { Input } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";

const FIELD = {
  input: "text-base placeholder:text-ink-muted",
  inputWrapper:
    "border-day-line bg-day-soft/70 transition-colors duration-700 ease-calm " +
    "hover:border-tekhelet-light/50 group-data-[focus=true]:border-tekhelet-light",
};

/** The reviewer's sign-in. Plain, on the same parchment as the rest of the archive. */
export function SignInCard({ onSubmit, error }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ username, password });
    } catch {
      setPassword("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card-stone mx-auto max-w-sm animate-rise px-8 py-10">
      <p className="eyebrow mb-3">{t("admin.kicker")}</p>
      <h1 className="font-display text-2xl text-ink">{t("admin.signInTitle")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("admin.signInLead")}</p>

      <div className="mt-8 flex flex-col gap-4">
        <Input
          value={username}
          onValueChange={setUsername}
          label={t("admin.username")}
          autoComplete="username"
          autoFocus
          radius="sm"
          variant="bordered"
          classNames={FIELD}
        />
        <Input
          value={password}
          onValueChange={setPassword}
          label={t("admin.password")}
          type="password"
          autoComplete="current-password"
          radius="sm"
          variant="bordered"
          classNames={FIELD}
        />
      </div>

      {error && (
        <p className="mt-5 animate-fade text-sm text-sun-deep">{t("admin.signInFailed")}</p>
      )}

      <Action
        type="submit"
        isLoading={saving}
        isDisabled={!username || !password}
        className="mt-8 w-full"
      >
        {t("admin.signIn")}
      </Action>
    </form>
  );
}
