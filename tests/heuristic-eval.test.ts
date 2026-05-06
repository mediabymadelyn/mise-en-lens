import { describe, it, expect } from "vitest";
import { heuristicFallback } from "@/lib/film-tutor/heuristic-eval";
import type { EvaluateRequest } from "@/lib/film-tutor/evaluation-types";
import type { ShortAnswerQuestion } from "@/lib/film-tutor/types";

const baseQuestion: ShortAnswerQuestion = {
  id: "q3",
  questionType: "short_answer",
  prompt: "What is a theme in Get Out and what scene shows it?",
  focus: "Interpretation",
  hint: "Think about a scene involving Chris and the Armitage family.",
  explanation: "Identifying a theme with scene evidence is the core move in film analysis.",
  maxWords: 18,
  placeholder: "The film explores racism through the party scene...",
  acceptableAnswers: ["family", "identity", "racism", "control", "power"],
  acceptableKeywords: ["isolation", "manipulation", "sunken", "belonging", "fear"],
  correctFeedback: "You named a theme and grounded it in a scene.",
  partialFeedback: "You named the theme — now anchor it in a specific scene.",
  incorrectFeedback: "Try naming one of the film's themes and a moment where it appears.",
  scaffoldSteps: [],
  fallbackMultipleChoice: null,
  revealAnswerAfterFallback: null,
  filmInFocus: "Get Out",
};

const baseFilm = { title: "Get Out", poster_url: null, film_url: null, source: "manual" as const };

function makeRequest(studentAnswer: string, overrides?: Partial<EvaluateRequest>): EvaluateRequest {
  return {
    question: baseQuestion,
    studentAnswer,
    priorTurns: [],
    films: [baseFilm],
    filmInFocus: "Get Out",
    ...overrides,
  };
}

describe("heuristicFallback — evaluateShortAnswer paths", () => {
  it("returns correct when answer has 5+ words and contains an acceptable answer", () => {
    const result = heuristicFallback(makeRequest("racism drives the film when chris arrives at the house"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verdict).toBe("correct");
  });

  it("returns partial when answer contains a keyword but is too short", () => {
    // "isolation here" = 2 words, 'isolation' is in acceptableKeywords
    const result = heuristicFallback(makeRequest("isolation here"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verdict).toBe("partial");
  });

  it("returns partial for a single word that matches an acceptable answer", () => {
    // "family" is in acceptableAnswers — keyword match must always route to partial, never off_base
    const result = heuristicFallback(makeRequest("family"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verdict).toBe("partial");
  });

  it("returns off_base for idk (single word under the word-count threshold)", () => {
    const result = heuristicFallback(makeRequest("idk"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verdict).toBe("off_base");
  });

  it("returns off_base for empty answer", () => {
    const result = heuristicFallback(makeRequest(""));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verdict).toBe("off_base");
  });

  it("returns memory_gap when student says they haven't seen the film", () => {
    const result = heuristicFallback(makeRequest("i don't remember this movie at all"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verdict).toBe("memory_gap");
  });

  it("returns concept_question when student asks for a definition", () => {
    const result = heuristicFallback(makeRequest("what is a theme"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verdict).toBe("concept_question");
  });

  it("returns partial for a long answer with no matching keywords or acceptable answers", () => {
    // 5+ words but nothing from acceptableAnswers or acceptableKeywords
    const result = heuristicFallback(makeRequest("the colors are very blue throughout"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verdict).toBe("partial");
  });
});
