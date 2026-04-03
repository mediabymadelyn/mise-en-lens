import type { LetterboxdFilm } from "@/lib/letterboxd/scraper";

export type TutorMode = "blurb" | "quiz";

export type QuizQuestion = {
  id: string;
  prompt: string;
  focus: string;
  hint: string;
  expectedAnswer: string;
  acceptableKeywords: string[];
  correctFeedback: string;
  partialFeedback: string;
  incorrectFeedback: string;
};

export type TutorPayload = {
  headline: string;
  overview: string;
  tasteProfile: string[];
  concept: {
    name: string;
    explanation: string;
    connection: string;
  };
  filmNotes: Array<{
    title: string;
    summary: string;
    artisticElements: string;
    societalContext: string;
  }>;
  recommendation: {
    title: string;
    whyYouMightLikeIt: string;
    educationalRedirect: string;
  };
  quiz: {
    intro: string;
    questions: QuizQuestion[];
  };
};

export type TutorResponse =
  | {
      ok: true;
      generatedBy: "openai" | "fallback";
      mode: TutorMode;
      username: string;
      source_url: string;
      films: LetterboxdFilm[];
      lesson: TutorPayload;
      warning?: string;
    }
  | {
      ok: false;
      error: string;
    };
