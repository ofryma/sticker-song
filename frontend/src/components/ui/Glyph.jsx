/* Line icons on the same 24px grid as the rest of the interface, kept as bare
   paths so one renderer draws them all. */
const ICON = {
  camera: "M3 8.5h3.2l1.4-2.2h8.8l1.4 2.2H21v10H3zM12 9.6a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z",
  swap: "M4 9h13l-3-3M20 15H7l3 3",
  cross: "M6 6l12 12M18 6L6 18",
  crop: ["M7.5 3v13.5H21", "M3 7.5h13.5V21"],
  rotateLeft: ["M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.4", "M3.5 4v4.5H8"],
  rotateRight: ["M20.5 12a8.5 8.5 0 1 1-2.6-6.1l2.6 2.5", "M20.5 4v4.5H16"],
  /* Two halves of one picture facing away from the line they were folded on. */
  flip: ["M12 3.5v17", "M9 7.5 4 12l5 4.5z", "M15 7.5 20 12l-5 4.5z"],
  /* The universal accessibility figure, drawn on the same line grid. */
  access: [
    "M12 3.1a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2",
    "M4.9 8.7c4.7 1.5 9.5 1.5 14.2 0",
    "M12 8.9v4.7",
    "M12 13.6 9.3 20.7",
    "M12 13.6l2.7 7.1",
  ],
};

/** One icon, at whatever size the caller asks for. */
export function Glyph({ name, className = "h-4 w-4" }) {
  const paths = [ICON[name]].flat();
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      {paths.map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
