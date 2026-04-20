import type { FilmInput, ShortAnswerQuestion } from "@/lib/film-tutor/types";

export type EvaluateRequest = {
  question: ShortAnswerQuestion;
  studentAnswer: string;
  priorTurns: Array<{ role: "tutor" | "user"; text: string }>;
  films: FilmInput[];
  filmInFocus: string;
};

export type EvaluateVerdict =
  | "correct"
  | "partial"
  | "off_base"
  | "concept_question"
  | "memory_gap";

export type EvaluateResponse =
  | {
      ok: true;
      verdict: EvaluateVerdict;
      feedback: string;
      nextHint?: string;
    }
  | { ok: false; error: string };
