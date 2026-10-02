import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizCard } from "@/components/quiz-card";

const question = {
  id: "source-check",
  question: "Which source supports this claim?",
  options: ["Official record", "Anonymous post"],
  correctIndex: 0,
  explanation: "Check the record.",
  citationIds: ["official-record"],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("practice quiz", () => {
  it("renders every question and sends the actual API contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <QuizCard
        quiz={[
          question,
          { ...question, id: "second", question: "Second evidence check?" },
        ]}
        sourceId="analysis-one"
      />,
    );
    expect(
      screen.getAllByRole("region", { name: /Knowledge check/ }),
    ).toHaveLength(2);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Official record" })[0],
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      quizId: "analysis-one",
      questionId: "source-check",
      selectedAnswer: "Official record",
      correctAnswer: "Official record",
      citationIds: ["official-record"],
    });
  });
  it("requires a deliberate retry and reports rejected logging honestly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<QuizCard quiz={question} />);
    fireEvent.click(screen.getByRole("button", { name: "Anonymous post" }));
    expect(
      screen.getByRole("button", { name: "Official record" }),
    ).toBeDisabled();
    await screen.findByText(/practice log is unavailable/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      screen.getByRole("button", { name: "Official record" }),
    ).toBeEnabled();
  });
  it("does not invent an answer for malformed generated questions", () => {
    const { container } = render(
      <QuizCard quiz={{ ...question, correctIndex: 9 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
