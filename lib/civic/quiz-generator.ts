import { createHash } from "crypto";
import type { Citation, QuizQuestion } from "../ai/schemas";

export function generateQuiz(citations: Citation[], seed = "civic-literacy"): QuizQuestion[] {
  const primary = citations[0];
  const key = stableQuizKey(primary, seed);
  const questions: QuizQuestion[] = [];
  const repeal = citations.find((citation) => /repeal/i.test(citation.excerpt) && /government pension offset/i.test(citation.excerpt) && /windfall elimination/i.test(citation.excerpt));
  if (repeal) {
    questions.push({
      id: `quiz-${key}-repeal`,
      question: "What change does the supplied official excerpt describe?",
      choices: ["Repealing the government pension offset and windfall elimination provisions", "Creating a new election system", "Changing congressional district boundaries", "Requiring everyone to receive the same benefit"],
      correctAnswer: "Repealing the government pension offset and windfall elimination provisions",
      explanation: "The excerpt states that the government pension offset and windfall elimination provisions were repealed.",
      citationIds: [repeal.id],
    });
  }
  const law = citations.find((citation) => /became.*public law|public law.*\d/i.test(`${citation.title} ${citation.excerpt}`));
  if (law) {
    questions.push({
      id: `quiz-${key}-law-status`,
      question: "What does a public-law record establish about the bill?",
      choices: ["It became law", "It guarantees a particular benefit for every person", "It has only been proposed", "It has not been introduced"],
      correctAnswer: "It became law",
      explanation: "The supplied record identifies a public law. Law status establishes enactment; an individual outcome requires separate evidence.",
      citationIds: [law.id],
    });
  }
  if (primary?.bill) {
    questions.push({
      id: `quiz-${key}-identity`,
      question: "What should match when you compare a bill claim with an official record?",
      choices: ["The Congress, bill type, and bill number", "Only the bill's nickname", "Only the topic in a headline", "The number of likes on the post"],
      correctAnswer: "The Congress, bill type, and bill number",
      explanation: "Bill numbers restart in each Congress. Match all parts of the bill identity before applying a record to a claim.",
      citationIds: [primary.id],
    });
  }
  if (questions.length === 0) {
    questions.push({
      id: `quiz-${key}-source`,
      question: "What should you check first before accepting a civic claim?",
      choices: ["Whether an official source supports the claim", "Whether the claim is popular on social media", "Whether the claim uses strong emotional language", "Whether the claim names a political party"],
      correctAnswer: "Whether an official source supports the claim",
      explanation: primary ? `Compare the claim with ${primary.title}. A citation supports only the details actually present in its excerpt.` : "Look for official source material before drawing a conclusion.",
      citationIds: primary ? [primary.id] : [],
    });
  }
  if (questions.length < 3) {
    questions.push({
      id: `quiz-${key}-evidence-gap`,
      question: "What should you do when the supplied excerpts do not settle a claim?",
      choices: ["Mark it unresolved and look for the missing evidence", "Treat it as false automatically", "Treat it as true automatically", "Use the most popular opinion instead"],
      correctAnswer: "Mark it unresolved and look for the missing evidence",
      explanation: "An unresolved claim needs more evidence. A related official source does not establish a fact that its excerpt leaves out.",
      citationIds: primary ? [primary.id] : [],
    });
  }
  return questions.slice(0, 3);
}

function stableQuizKey(primary: Citation | undefined, seed: string): string {
  return createHash("sha256").update(primary?.id ?? seed).digest("hex").slice(0, 16);
}
