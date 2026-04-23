import type { FilmInput, ShortAnswerQuestion } from "@/lib/film-tutor/types";

export type EvaluateRequest = {
  question: ShortAnswerQuestion;
  studentAnswer: string;
  priorTurns: Array<{ role: "tutor" | "user"; text: string }>;
  films: FilmInput[];
  filmInFocus: string;
  interpretationOverrideSent?: boolean;
  compareOverrideSent?: boolean;
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
      interpretationOverrideSent?: boolean;
      compareOverrideSent?: boolean;
    }
  | { ok: false; error: string };
