import { SearchField } from "./SearchField.jsx";

/**
 * The wall's search, held at the foot of the viewport so it stays in reach
 * while the images scroll past. Sticky rather than fixed: it releases at the
 * end of the page instead of sitting on top of the footer. On small screens it
 * rests above the thumb nav.
 */
export function WallSearchBar({ value, onChange }) {
  return (
    <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-12 border-t border-day-line/70 bg-day/95 backdrop-blur-md sm:bottom-0 sm:-mx-8">
      <div className="mx-auto flex max-w-6xl justify-center px-4 py-3 sm:px-8 sm:py-4">
        <SearchField value={value} onChange={onChange} />
      </div>
    </div>
  );
}
