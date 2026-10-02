import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedBrowser } from "@/components/feed-browser";
import { LEARNING_PROGRESS_KEY } from "@/lib/learning-progress";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
const first = {
  slug: "first-lesson",
  title: "Learn the first idea",
  body: "Government powers are allocated by law.",
  category: "Foundations",
  sourceIds: ["source-one"],
  citations: [
    {
      id: "source-one",
      title: "National Archives Constitution",
      url: "https://www.archives.gov/founding-docs/constitution-transcript",
      excerpt: "Read the constitutional text.",
    },
  ],
  flashcards: [
    {
      id: "card-one",
      title: "Teach before testing",
      body: "Read this idea first.",
      citationIds: ["source-one"],
    },
    {
      id: "card-two",
      title: "Apply the idea",
      body: "Check who has legal authority.",
      citationIds: ["source-one"],
    },
  ],
  quizQuestions: [
    {
      id: "q-one",
      question: "What evidence should you check?",
      options: ["Official record", "An anonymous rumor"],
      correctIndex: 0,
      feedback: {
        correct: "Good evidence.",
        incorrect: "A rumor is not an official record.",
      },
      citationIds: ["source-one"],
    },
    {
      id: "q-two",
      question: "What comes next?",
      options: ["Skip the context", "Read the context"],
      correctIndex: 1,
      citationIds: ["source-one"],
    },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                first,
                {
                  ...first,
                  slug: "second-lesson",
                  title: "Learn the next idea",
                },
              ],
            }),
          ),
        ),
      ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function teachCards() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Start next lesson" }),
  );
  expect(screen.getByText("Teach before testing")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Continue lesson/ }));
  expect(screen.getByText("Apply the idea")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Continue lesson/ }));
}

describe("learning flow", () => {
  it("requires every check, persists completion, and keeps errors available for review", async () => {
    render(<FeedBrowser />);
    await teachCards();
    expect(
      screen.getByRole("button", { name: /Next question/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "An anonymous rumor" }));
    expect(
      screen.getByRole("button", { name: /Next question/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Official record" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Official record" }));
    fireEvent.click(screen.getByRole("button", { name: /Next question/ }));
    expect(
      screen.getByRole("button", { name: /Complete lesson/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Read the context" }));
    fireEvent.click(screen.getByRole("button", { name: /Complete lesson/ }));
    expect(
      screen.getByRole("heading", { name: "Lesson complete" }),
    ).toBeVisible();
    expect(screen.getByText("+25 XP")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to path" }));
    expect(screen.getByText("25 XP")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Review missed concepts/ }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: /Level 2:/ })).toBeEnabled();
    await waitFor(() =>
      expect(
        JSON.parse(window.localStorage.getItem(LEARNING_PROGRESS_KEY)!)
          .completed["first-lesson"],
      ).toBeTruthy(),
    );
    cleanup();
    render(<FeedBrowser />);
    await screen.findByText("25 XP");
    expect(
      await screen.findByRole("option", { name: /Level 2:/ }),
    ).toBeEnabled();
  });
  it("starts at zero and makes official evidence accessible alongside teaching", async () => {
    render(<FeedBrowser />);
    await screen.findByRole("button", { name: "Start next lesson" });
    expect(screen.getByText("0 XP")).toBeVisible();
    expect(screen.getByRole("option", { name: /Level 2:/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Start next lesson" }));
    fireEvent.click(screen.getByText("Check the official sources (1)"));
    expect(
      screen.getByRole("link", { name: "National Archives Constitution" }),
    ).toHaveAttribute(
      "href",
      "https://www.archives.gov/founding-docs/constitution-transcript",
    );
  });
});
