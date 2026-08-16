import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../../test/render.jsx";
import { BackupsView } from "./BackupsView.jsx";

vi.mock("../../lib/admin.js", () => ({ backups: vi.fn() }));
const admin = await import("../../lib/admin.js");

const snapshot = (overrides = {}) => ({
  id: "2026-08-15T031000Z",
  finished_at: "2026-08-15T03:12:00Z",
  entries: 7,
  rows: { memorial_entries: 7 },
  object_count: 14,
  object_bytes: 5_368_709_120,
  dump_bytes: 1024,
  alembic_version: "0005",
  image_tag: "sha-abc123",
  ...overrides,
});

const status = (overrides = {}) => ({
  configured: true,
  last_success: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  stale: false,
  stale_after_hours: 30,
  snapshots: [snapshot()],
  ...overrides,
});

const view = () => renderApp(<BackupsView token="t" onExpired={vi.fn()} />);

beforeEach(() => vi.clearAllMocks());

describe("the backups tab", () => {
  it("says when the archive was last copied, and what that copy holds", async () => {
    admin.backups.mockResolvedValue(status());
    view();

    expect(await screen.findByText(/Last copied/)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("5.0 GB")).toBeInTheDocument();
    expect(screen.getByText("sha-abc123")).toBeInTheDocument();
  });

  it("keeps the newest copy at the top", async () => {
    admin.backups.mockResolvedValue(
      status({
        snapshots: [snapshot({ id: "b", entries: 7 }), snapshot({ id: "a", entries: 5 })],
      }),
    );
    view();

    const rows = await screen.findAllByRole("row");
    // The header is the first row; the newest snapshot is the one marked.
    expect(rows[1]).toHaveTextContent(text("admin.backups.newest"));
    expect(rows[1]).toHaveTextContent("7");
  });

  it("says plainly that a development stack has no drive", async () => {
    admin.backups.mockResolvedValue({ configured: false, snapshots: [] });
    view();

    expect(await screen.findByText(text("admin.backups.noDrive"))).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says that the copying has stopped, not that the archive has", async () => {
    admin.backups.mockResolvedValue(status({ stale: true }));
    view();

    expect(await screen.findByText(text("admin.backups.stale", { hours: 30 }))).toBeInTheDocument();
  });

  it("offers to try again when the drive cannot be read", async () => {
    admin.backups.mockRejectedValue(new Error("nope"));
    view();

    expect(await screen.findByText(text("common.error"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text("common.retry") })).toBeInTheDocument();
  });

  it("sends an expired session back to the sign-in card rather than showing an error", async () => {
    const onExpired = vi.fn();
    const expired = Object.assign(new Error("unauthorized"), { code: "unauthorized" });
    admin.backups.mockRejectedValue(expired);
    renderApp(<BackupsView token="t" onExpired={onExpired} />);

    await vi.waitFor(() => expect(onExpired).toHaveBeenCalled());
    expect(screen.queryByText(text("common.error"))).not.toBeInTheDocument();
  });
});
