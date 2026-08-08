/**
 * The vocabulary the review queue speaks — the filters, the sorts and the page
 * size — and the query it turns into. The backend applies all of it: with
 * thousands of stickers the browser holds one page, never the archive.
 *
 * No React, no fetching. `admin.js` sends what `queryFor` builds.
 */

export const PERIODS = ["any", "day", "week", "month"];
export const READS = ["any", "flag", "ok", "unread"];
/** Column keys the table can sort by; the backend names them the same. */
export const SORTS = ["added", "name", "status", "read"];

const PERIOD_DAYS = { day: 1, week: 7, month: 30 };

export const PAGE_SIZE = 20;
export const DEFAULT_FILTERS = { query: "", period: "any", read: "any" };
export const DEFAULT_SORT = { column: "added", direction: null };

/** Whether the reviewer has narrowed anything, for the difference between
 *  "nothing here" and "nothing matches". */
export function isFiltered(filters) {
  return filters.query.trim() !== "" || filters.period !== "any" || filters.read !== "any";
}

/**
 * One page of the queue as query parameters. `direction` is left out when the
 * reviewer has not chosen one, so the backend can keep its own default: oldest
 * first for what is waiting, newest first for everything else.
 */
export function queryFor({ status, filters, sort, page, pageSize = PAGE_SIZE }) {
  const query = filters.query.trim();
  return {
    status,
    read: filters.read,
    sort: sort.column,
    ...(sort.direction ? { order: sort.direction } : {}),
    ...(query ? { q: query } : {}),
    ...(PERIOD_DAYS[filters.period] ? { added_within_days: PERIOD_DAYS[filters.period] } : {}),
    limit: pageSize,
    offset: page * pageSize,
  };
}

/**
 * The order the backend would choose on its own, stated here too so the arrow
 * the reviewer sees is the order they actually get: oldest first for what is
 * waiting, newest first for everything else.
 */
export function defaultDirection(column, status) {
  return column === "added" && status === "pending" ? "asc" : "desc";
}

export function resolveSort(sort, status) {
  return {
    column: sort.column,
    direction: sort.direction ?? defaultDirection(sort.column, status),
  };
}
