import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  isFiltered,
  PAGE_SIZE,
  queryFor,
  resolveSort,
} from "./review.js";

const request = (over = {}) => ({
  status: "pending",
  filters: DEFAULT_FILTERS,
  sort: { column: "added", direction: "asc" },
  page: 0,
  ...over,
});

describe("the query one page of the queue asks for", () => {
  it("sends the slice, the sort and the page, and nothing it was not asked", () => {
    expect(queryFor(request())).toEqual({
      status: "pending",
      read: "any",
      sort: "added",
      order: "asc",
      limit: PAGE_SIZE,
      offset: 0,
    });
  });

  it("leaves the order out until the reviewer chooses one, so the backend decides", () => {
    const query = queryFor(request({ sort: DEFAULT_SORT }));

    expect(query).not.toHaveProperty("order");
  });

  it("turns a named period into the window the backend counts in days", () => {
    expect(queryFor(request({ filters: { ...DEFAULT_FILTERS, period: "week" } }))).toMatchObject({
      added_within_days: 7,
    });
    expect(queryFor(request({ filters: { ...DEFAULT_FILTERS, period: "month" } }))).toMatchObject({
      added_within_days: 30,
    });
    expect(
      queryFor(request({ filters: { ...DEFAULT_FILTERS, period: "any" } })),
    ).not.toHaveProperty("added_within_days");
  });

  it("trims the search and drops it when it holds nothing", () => {
    expect(
      queryFor(request({ filters: { ...DEFAULT_FILTERS, query: "  dvora  " } })),
    ).toMatchObject({ q: "dvora" });
    expect(queryFor(request({ filters: { ...DEFAULT_FILTERS, query: "   " } }))).not.toHaveProperty(
      "q",
    );
  });

  it("offsets by whole pages", () => {
    expect(queryFor(request({ page: 3 }))).toMatchObject({
      limit: PAGE_SIZE,
      offset: PAGE_SIZE * 3,
    });
  });
});

describe("the default order", () => {
  it("puts the oldest first while entries are waiting, so none waits behind newer ones", () => {
    expect(resolveSort(DEFAULT_SORT, "pending")).toEqual({ column: "added", direction: "asc" });
  });

  it("puts the newest first everywhere else", () => {
    expect(resolveSort(DEFAULT_SORT, "published").direction).toBe("desc");
    expect(resolveSort({ column: "name", direction: null }, "pending").direction).toBe("desc");
  });

  it("keeps a direction the reviewer chose", () => {
    expect(resolveSort({ column: "added", direction: "desc" }, "pending").direction).toBe("desc");
  });
});

describe("telling an empty queue from an empty result", () => {
  it("is unfiltered by default", () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, query: "  " })).toBe(false);
  });

  it("counts any narrowing", () => {
    expect(isFiltered({ ...DEFAULT_FILTERS, query: "a" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, period: "week" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, read: "flag" })).toBe(true);
  });
});
