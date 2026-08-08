import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, text } from "../../test/render.jsx";
import { PhotoField } from "./PhotoField.jsx";

/**
 * jsdom has no camera, no media pipeline and no canvas encoder, so the three
 * pieces the viewfinder leans on are stood up here rather than in the shared
 * setup — nothing else in the suite needs them.
 */
function stubMedia({ getUserMedia }) {
  navigator.mediaDevices = { getUserMedia };
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true,
    get: () => 1280,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    configurable: true,
    get: () => 960,
  });
  HTMLCanvasElement.prototype.toBlob = vi.fn((done) =>
    done(new Blob(["frame"], { type: "image/jpeg" })),
  );
}

function liveStream() {
  const track = { stop: vi.fn(), getSettings: () => ({ facingMode: "environment" }) };
  return { getTracks: () => [track], getVideoTracks: () => [track], track };
}

/** The shared setup reports a phone; this widens the viewport for one test. */
function atADesk(body) {
  const narrow = window.matchMedia;
  window.matchMedia = vi.fn((media) => ({
    matches: true,
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  try {
    body();
  } finally {
    window.matchMedia = narrow;
  }
}

afterEach(() => {
  delete navigator.mediaDevices;
});

describe("the way into the photo step", () => {
  it("leads with the camera on a phone and keeps the device quiet behind it", () => {
    stubMedia({ getUserMedia: vi.fn() });
    renderApp(<PhotoField preview={null} onPick={vi.fn()} />);

    expect(screen.getByRole("button", { name: text("contribute.openCamera") })).toBeVisible();
    expect(screen.getByRole("button", { name: text("contribute.dropzoneMobile") })).toBeVisible();
    // The drag-and-drop invitation is meaningless on a phone.
    expect(screen.queryByText(text("contribute.dropzone"))).toBeNull();
  });

  it("leads with the drop surface at a desk, the camera beside it", () => {
    stubMedia({ getUserMedia: vi.fn() });
    atADesk(() => {
      renderApp(<PhotoField preview={null} onPick={vi.fn()} />);
      expect(screen.getByText(text("contribute.dropzone"))).toBeVisible();
      expect(screen.getByRole("button", { name: text("contribute.openCamera") })).toBeVisible();
      expect(screen.queryByRole("button", { name: text("contribute.dropzoneMobile") })).toBeNull();
    });
  });
});

describe("camera capture", () => {
  let onPick;

  beforeEach(() => {
    onPick = vi.fn();
  });

  it("offers no camera button where the browser has no camera to give", () => {
    renderApp(<PhotoField preview={null} onPick={onPick} />);
    expect(screen.queryByRole("button", { name: text("contribute.openCamera") })).toBeNull();
  });

  it("hands a photograph taken in the page straight to the draft", async () => {
    const stream = liveStream();
    stubMedia({ getUserMedia: vi.fn(() => Promise.resolve(stream)) });
    const user = userEvent.setup();
    renderApp(<PhotoField preview={null} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: text("contribute.openCamera") }));

    const shutter = await screen.findByRole("button", { name: text("contribute.cameraShutter") });
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);

    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    const file = onPick.mock.calls[0][0];
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toMatch(/^sticker-.*\.jpg$/);
    // Closing the sheet must release the camera, not leave the light on.
    await waitFor(() => expect(stream.track.stop).toHaveBeenCalled());
  });

  it("explains a refused permission and keeps the file picker in place", async () => {
    const denied = Object.assign(new Error("no"), { name: "NotAllowedError" });
    stubMedia({ getUserMedia: vi.fn(() => Promise.reject(denied)) });
    const user = userEvent.setup();
    renderApp(<PhotoField preview={null} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: text("contribute.openCamera") }));

    expect(await screen.findByText(text("contribute.cameraDenied"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text("contribute.cameraShutter") })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: text("contribute.cameraCancel") }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: text("contribute.openCamera") })).toBeVisible(),
    );
    expect(onPick).not.toHaveBeenCalled();
  });
});
