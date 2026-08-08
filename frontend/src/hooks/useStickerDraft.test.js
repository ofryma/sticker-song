import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rejectReason, STEPS, useStickerDraft } from "./useStickerDraft.js";

vi.mock("../lib/api.js", () => ({ createEntry: vi.fn() }));
const { createEntry } = await import("../lib/api.js");

const photo = () => new File(["bytes"], "sticker.jpg", { type: "image/jpeg" });

/** Fill in enough that every step is satisfied, without moving between them. */
function fill(result) {
  act(() => result.current.setImage(photo()));
  act(() => result.current.set({ personName: "Some Name" }));
  act(() => result.current.set({ stickerText: "What the sticker says" }));
}

beforeEach(() => {
  createEntry.mockReset();
});

describe("step movement", () => {
  it("starts on the photo step with nothing filled in", () => {
    const { result } = renderHook(() => useStickerDraft());

    expect(result.current.step).toBe("photo");
    expect(result.current.canAdvance).toBe(false);
    // A blocker is only shown once the visitor has tried to move on.
    expect(result.current.blocker).toBe(null);
  });

  it("names the unmet requirement after a blocked attempt to advance", () => {
    const { result } = renderHook(() => useStickerDraft());

    act(() => result.current.next());

    expect(result.current.step).toBe("photo");
    expect(result.current.blocker).toBe("image");
  });

  it("clears the shown blocker as soon as the field is filled", () => {
    const { result } = renderHook(() => useStickerDraft());

    act(() => result.current.next());
    act(() => result.current.setImage(photo()));

    expect(result.current.blocker).toBe(null);
    expect(result.current.canAdvance).toBe(true);
  });

  it("walks photo → name → text → place and stops at the last step", () => {
    const { result } = renderHook(() => useStickerDraft());
    fill(result);

    for (const step of STEPS) {
      expect(result.current.step).toBe(step);
      act(() => result.current.next());
    }

    expect(result.current.step).toBe("place");
    expect(result.current.isLast).toBe(true);
  });

  it("requires a name and sticker text, but not a location", () => {
    const { result } = renderHook(() => useStickerDraft());
    act(() => result.current.setImage(photo()));
    act(() => result.current.next());

    act(() => result.current.next());
    expect(result.current.step).toBe("name");
    expect(result.current.blocker).toBe("name");

    act(() => result.current.set({ personName: "  " }));
    act(() => result.current.next());
    // Whitespace is not a name.
    expect(result.current.step).toBe("name");

    act(() => result.current.set({ personName: "Some Name" }));
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.blocker).toBe("text");

    act(() => result.current.set({ stickerText: "Words" }));
    act(() => result.current.next());
    // The place step has no requirement at all.
    expect(result.current.step).toBe("place");
    expect(result.current.canAdvance).toBe(true);
  });

  it("goes back, and never past the first step", () => {
    const { result } = renderHook(() => useStickerDraft());
    fill(result);
    act(() => result.current.next());

    act(() => result.current.back());
    expect(result.current.stepIndex).toBe(0);
    act(() => result.current.back());
    expect(result.current.stepIndex).toBe(0);
  });
});

describe("the photograph", () => {
  it("exposes a preview and revokes the previous one when it is swapped", () => {
    const { result } = renderHook(() => useStickerDraft());

    act(() => result.current.setImage(photo()));
    const first = result.current.preview;
    expect(first).toMatch(/^blob:/);

    act(() => result.current.setImage(photo()));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(first);
    expect(result.current.preview).not.toBe(first);
  });

  it("revokes the object URL when the flow unmounts", () => {
    const { result, unmount } = renderHook(() => useStickerDraft());
    act(() => result.current.setImage(photo()));
    const url = result.current.preview;

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });

  it("rejects a non-image and anything over 10MB", () => {
    expect(rejectReason(new File(["x"], "a.pdf", { type: "application/pdf" }))).toBe("image");

    const huge = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(huge, "size", { value: 11 * 1024 * 1024 });
    expect(rejectReason(huge)).toBe("size");

    expect(rejectReason(photo())).toBe(null);
  });
});

describe("submitting", () => {
  const saved = { id: "new-1", person_name: "Some Name" };

  it("sends the draft and keeps the duplicate verdict that comes back", async () => {
    createEntry.mockResolvedValue({
      entry: saved,
      possible_duplicates: [{ id: "old-1" }],
      suggested_best_id: "old-1",
    });
    const { result } = renderHook(() => useStickerDraft());
    fill(result);

    await act(() => result.current.submit());

    expect(createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ personName: "Some Name", stickerText: "What the sticker says" }),
    );
    expect(result.current.state).toBe("done");
    expect(result.current.saved).toEqual(saved);
    expect(result.current.duplicates).toEqual([{ id: "old-1" }]);
    expect(result.current.suggestedBestId).toBe("old-1");
  });

  it("treats a response with no duplicate fields as no duplicates", async () => {
    createEntry.mockResolvedValue({ entry: saved });
    const { result } = renderHook(() => useStickerDraft());
    fill(result);

    await act(() => result.current.submit());

    expect(result.current.duplicates).toEqual([]);
    expect(result.current.suggestedBestId).toBe(null);
  });

  it("reports a failure and keeps the draft so it can be retried", async () => {
    createEntry.mockRejectedValue(new Error("bucket unreachable"));
    const { result } = renderHook(() => useStickerDraft());
    fill(result);

    await act(() => result.current.submit());

    expect(result.current.state).toBe("error");
    expect(result.current.error.message).toBe("bucket unreachable");
    expect(result.current.draft.personName).toBe("Some Name");
    expect(result.current.draft.image).toBeInstanceOf(File);
  });

  it("is in the saving state while the upload is in flight", async () => {
    let finish;
    createEntry.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useStickerDraft());
    fill(result);

    act(() => void result.current.submit());
    await waitFor(() => expect(result.current.state).toBe("saving"));

    await act(async () => finish({ entry: saved }));
    expect(result.current.state).toBe("done");
  });

  it("resets to an empty draft, releasing the preview", async () => {
    createEntry.mockResolvedValue({ entry: saved, possible_duplicates: [{ id: "old-1" }] });
    const { result } = renderHook(() => useStickerDraft());
    fill(result);
    await act(() => result.current.submit());
    const url = result.current.preview;

    act(() => result.current.reset());

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(result.current.preview).toBe(null);
    expect(result.current.draft).toEqual({
      image: null,
      personName: "",
      stickerText: "",
      latitude: null,
      longitude: null,
    });
    expect(result.current.step).toBe("photo");
    expect(result.current.state).toBe("editing");
    expect(result.current.saved).toBe(null);
    expect(result.current.duplicates).toEqual([]);
  });
});
