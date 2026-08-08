/* How the leaf is coloured. `olive` is the mark as it stands on parchment;
   `current` borrows the text colour, for the leaf inside a solid button. */
const PALETTE = {
  olive: {
    stem: "stroke-olive-deep/80",
    sprout: "fill-olive/60",
    leaf: "fill-olive",
    midrib: "stroke-olive-deep/55",
  },
  current: {
    stem: "stroke-current opacity-70",
    sprout: "fill-current opacity-55",
    leaf: "fill-current",
    midrib: "stroke-current opacity-40",
  },
};

/**
 * An olive leaf on its stem — the mark of the archive, and of the remembering
 * gesture. `open` fills the leaf; unopened it is a quiet outline waiting to be
 * added. `size` scales the whole thing in one place, and `sizeSm` grows it from
 * `sm` up — the root carries its own display, so a caller must never hide one
 * copy and show another. It grows into place once and then holds: a leaf does
 * not flicker.
 */
export function Sprig({ size = 48, sizeSm, open = true, tone = "olive", className = "" }) {
  const paint = PALETTE[tone] ?? PALETTE.olive;

  return (
    <span
      className={
        "relative inline-flex items-end justify-center " +
        "w-[var(--sprig)] h-[calc(var(--sprig)*1.35)] " +
        "sm:w-[var(--sprig-sm)] sm:h-[calc(var(--sprig-sm)*1.35)] " +
        className
      }
      style={{ "--sprig": `${size}px`, "--sprig-sm": `${sizeSm ?? size}px` }}
      aria-hidden="true"
    >
      {/* Daylight pools behind the mark on parchment; on a coloured surface
          there is no light to pool, so it is left off. */}
      {open && tone === "olive" && (
        <span className="animate-breathe absolute bottom-[38%] h-[62%] w-[170%] rounded-full bg-sun/20 blur-2xl" />
      )}

      <svg viewBox="0 0 24 32" className="relative h-full w-full overflow-visible" fill="none">
        {/* Stem, drawn first so the leaf covers the join. */}
        <path
          d="M12 31V16"
          className={open ? paint.stem : "stroke-ink-faint/50"}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        {/* A second, smaller leaf low on the stem: enough to read as growth,
            small enough to disappear rather than smudge at 15px. */}
        <path
          d="M12 23c-3.4-1.2-5-3.2-4.8-6 2.8.5 4.5 2.4 4.8 6z"
          className={open ? paint.sprout : "fill-ink-faint/15"}
        />
        {/* The leaf. */}
        <path
          d="M12 2.4c5.6 5.5 5.6 12.5 0 18-5.6-5.5-5.6-12.5 0-18z"
          className={open ? paint.leaf : "fill-transparent stroke-ink-faint/60"}
          strokeWidth="0.9"
        />
        {open && (
          <path d="M12 4.6v14.2" className={paint.midrib} strokeWidth="0.8" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}
