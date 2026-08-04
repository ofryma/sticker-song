/**
 * A yahrzeit candle. The flame flickers on an irregular cycle so it never
 * reads as a loading spinner, and `size` scales the whole thing in one place.
 */
export function Candle({ size = 48, lit = true, className = "" }) {
  return (
    <span
      className={`relative inline-flex items-end justify-center ${className}`}
      style={{ width: size, height: size * 1.6 }}
      aria-hidden="true"
    >
      {lit && (
        <span
          className="absolute bottom-[52%] h-[70%] w-[190%] rounded-full bg-flame/25 blur-2xl animate-halo"
          style={{ animationDelay: "-1.3s" }}
        />
      )}

      <svg viewBox="0 0 24 40" className="relative h-full w-full overflow-visible" fill="none">
        {/* Glass holder */}
        <path
          d="M6 15h12v21a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z"
          className="fill-stone-200/10 stroke-stone-200/25"
          strokeWidth="0.8"
        />
        <path d="M6 19h12" className="stroke-stone-200/15" strokeWidth="0.7" />
        {/* Wax */}
        <path
          d="M7.2 22h9.6v13.4a1.8 1.8 0 0 1-1.8 1.8H9a1.8 1.8 0 0 1-1.8-1.8z"
          className={lit ? "fill-flame-glow/30" : "fill-stone-200/12"}
        />
        {/* Wick */}
        <path d="M12 22v-3.4" className="stroke-stone-400" strokeWidth="1" />

        {lit && (
          <g className="origin-bottom animate-flicker" style={{ transformBox: "fill-box" }}>
            <ellipse cx="12" cy="12.6" rx="4.4" ry="6.4" className="fill-flame/25" />
            <path
              d="M12 4.6c2.9 2.6 4.2 4.9 4.2 7.4 0 2.6-1.9 4.6-4.2 4.6s-4.2-2-4.2-4.6c0-2.5 1.3-4.8 4.2-7.4z"
              className="fill-flame-warm"
            />
            <path
              d="M12 8.4c1.5 1.6 2.2 3 2.2 4.3 0 1.4-1 2.5-2.2 2.5s-2.2-1.1-2.2-2.5c0-1.3.7-2.7 2.2-4.3z"
              className="fill-flame-glow"
            />
          </g>
        )}
      </svg>
    </span>
  );
}
