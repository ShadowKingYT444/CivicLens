import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyzeClient } from "@/components/analyze-client";
import { getJson } from "@/components/api";

vi.mock("@/components/api", async (original) => ({
  ...(await original<typeof import("@/components/api")>()),
  getJson: vi.fn(),
}));
vi.mock("@/lib/client-claim-handoff", () => ({ takePendingClaim: () => "" }));

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function answer(text: string) {
  return {
    mode: "demo",
    result: {
      status: "answered",
      normalizedClaim: text,
      verdictSummary: `Answer: ${text}`,
    },
    citations: [],
  };
}

beforeEach(() => vi.mocked(getJson).mockReset());
afterEach(cleanup);

describe("Analyze request continuity", () => {
  it("aborts on edit and ignores the old response even if it resolves anyway", async () => {
    const pending = deferred();
    vi.mocked(getJson).mockReturnValue(pending.promise);
    render(<AnalyzeClient />);
    const input = screen.getByLabelText("Claim or bill question");
    fireEvent.change(input, {
      target: { value: "The original bill question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    const signal = vi.mocked(getJson).mock.calls[0][1]?.signal;
    fireEvent.change(input, { target: { value: "A different bill question" } });
    expect(signal?.aborted).toBe(true);
    await act(async () =>
      pending.resolve(answer("The original bill question")),
    );
    expect(
      screen.queryByText("Answer: The original bill question"),
    ).not.toBeInTheDocument();
    expect(input).toHaveValue("A different bill question");
    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();
  });

  it("does not let an old request clear a newer request's loading state", async () => {
    const old = deferred();
    const fresh = deferred();
    vi.mocked(getJson)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    render(<AnalyzeClient />);
    const input = screen.getByLabelText("Claim or bill question");
    fireEvent.change(input, {
      target: { value: "An older question for Congress" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    fireEvent.click(screen.getByRole("button", { name: "Gas prices" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => old.resolve(answer("Old answer")));
    expect(screen.getByRole("button", { name: "Analyzing" })).toBeDisabled();
    expect(screen.queryByText("Answer: Old answer")).not.toBeInTheDocument();
    await act(async () => fresh.resolve(answer("New answer")));
    expect(screen.getByText("Answer: New answer")).toBeInTheDocument();
  });

  it("cancels or clears without publishing a late result and retains the draft on cancel", async () => {
    const pending = deferred();
    vi.mocked(getJson).mockReturnValue(pending.promise);
    render(<AnalyzeClient />);
    const input = screen.getByLabelText("Claim or bill question");
    fireEvent.change(input, {
      target: { value: "What did this bill change?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    expect(input).toHaveValue("What did this bill change?");
    expect(vi.mocked(getJson).mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => pending.resolve(answer("Late answer")));
    expect(screen.queryByText("Answer: Late answer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear text" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("shows all citation links and states deterministic mode truthfully", async () => {
    vi.mocked(getJson).mockResolvedValue({
      ...answer("A bill answer"),
      citations: Array.from({ length: 4 }, (_, i) => ({
        title: `Record ${i + 1}`,
        url: `https://example.org/${i}`,
      })),
    });
    render(<AnalyzeClient />);
    expect(screen.queryByText("AI ready")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "H.R. 82" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await waitFor(() =>
      expect(screen.getByText("Demo fallback")).toBeInTheDocument(),
    );
    expect(screen.getAllByRole("link", { name: /Record/ })).toHaveLength(4);
    expect(screen.getByText(/prepared without live AI/)).toBeInTheDocument();
  });
});
