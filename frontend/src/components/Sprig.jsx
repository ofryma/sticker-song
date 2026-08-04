/**
 * An olive leaf on its stem — the mark of the archive, and of the remembering
 * gesture. `open` fills the leaf; unopened it is a quiet outline waiting to be
 * added. `size` scales the whole thing in one place. It grows into place once
 * and then holds: a leaf does not flicker.
 */
export function Sprig({ size = 48, open = true, className = "" }) {
  return (
    <span
      className={`relative inline-flex items-end justify-center ${className}`}
      style={{ width: size, height: size * 1.35 }}
      aria-hidden="true"
    >
      {open && (
        <span className="animate-breathe absolute bottom-[38%] h-[62%] w-[170%] rounded-full bg-sun/20 blur-2xl" />
      )}

      <svg viewBox="0 0 24 32" className="relative h-full w-full overflow-visible" fill="none">
        {/* Stem, drawn first so the leaf covers the join. */}
        <path
          d="M12 31V16"
          className={open ? "stroke-olive-deep/80" : "stroke-ink-faint/50"}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        {/* A second, smaller leaf low on the stem: enough to read as growth,
            small enough to disappear rather than smudge at 15px. */}
        <path
          d="M12 23c-3.4-1.2-5-3.2-4.8-6 2.8.5 4.5 2.4 4.8 6z"
          className={open ? "fill-olive/60" : "fill-ink-faint/15"}
        />
        {/* The leaf. */}
        <path
          d="M12 2.4c5.6 5.5 5.6 12.5 0 18-5.6-5.5-5.6-12.5 0-18z"
          className={open ? "fill-olive" : "fill-transparent stroke-ink-faint/60"}
          strokeWidth="0.9"
        />
        {open && (
          <path
            d="M12 4.6v14.2"
            className="stroke-olive-deep/55"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        )}
      </svg>
    </span>
  );
}
