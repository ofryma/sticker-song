import { useReveal } from "../hooks/useReveal.js";

/** A page section that fades up once, the first time it is scrolled to. */
export function Section({ children, className = "", ...rest }) {
  const ref = useReveal();
  return (
    <section ref={ref} className={`reveal ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function SectionHeading({ kicker, title, lead, action }) {
  return (
    <div className="mb-10 flex flex-col gap-5 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {kicker && <p className="eyebrow mb-4">{kicker}</p>}
        <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h2>
        {lead && <p className="mt-4 text-sm leading-relaxed text-ink-muted sm:text-base">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

/** Standard page shell: max width, gutters, and room to breathe at the top. */
export function Page({ children, className = "" }) {
  return (
    <div className={`mx-auto max-w-6xl px-4 pt-12 sm:px-8 sm:pt-28 ${className}`}>{children}</div>
  );
}
