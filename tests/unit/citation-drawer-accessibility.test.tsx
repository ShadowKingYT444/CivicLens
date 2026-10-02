import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CitationDrawer } from "@/components/citation-drawer";

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no native dialog implementation; browser QA verifies inertness.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Sources modal keyboard continuity", () => {
  it("cycles both Tab boundaries, closes on Escape, and restores trigger focus", () => {
    render(
      <CitationDrawer
        citations={[
          { title: "Official record", url: "https://example.org/record" },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Sources (1)" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close" });
    const link = screen.getByRole("link", { name: "Official record" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(link).toHaveFocus();
    fireEvent.keyDown(link, { key: "Tab" });
    expect(close).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    act(() => vi.runAllTimers());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("dismisses a backdrop click but keeps inside content open", () => {
    render(
      <CitationDrawer
        citations={[{ title: "Official record", excerpt: "Source text" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sources (1)" }));
    fireEvent.click(screen.getByText("Source text"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("dialog"));
    act(() => vi.runAllTimers());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
