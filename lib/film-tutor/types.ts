import type { LetterboxdFilm } from "@/lib/letterboxd/scraper";

export type TutorMode = "blurb" | "quiz";

export type FilmInput = {
  title: string;
  poster_url: string | null;   // null for manual entry unless wiki summary has thumbnail
  film_url: string | null;     // null for manual entry
  source: "letterboxd" | "manual";
};

type QuizQuestionBase = {
  id: string;
  prompt: string;
  focus: string;
  hint: string;
  explanation: string;
  correctFeedback: string;
  partialFeedback: string;
  incorrectFeedback: string;
};

export type MultipleChoiceQuestion = QuizQuestionBase & {
  questionType: "multiple_choice";
  options: string[];
  correctAnswer: string;
};

export type ScaffoldStep = {
  prompt: string;
  hint: string;
  expectedFocus: string;
};

export type ShortAnswerQuestion = QuizQuestionBase & {
  questionType: "short_answer";
  maxWords: number;
  placeholder: string;
  acceptableAnswers: string[];
  acceptableKeywords: string[];
  scaffoldSteps: ScaffoldStep[];
  fallbackMultipleChoice: {
    prompt: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  };
  revealAnswerAfterFallback: boolean;
};

export type QuizQuestion = MultipleChoiceQuestion | ShortAnswerQuestion;

export type TransferSequence = {
  concept: string;
  filmA: string;
  filmB: string;
  teachStatement: string;  // 2-3 sentences rendered above Q5
  verifyQuestionId: string; // references Q5 by id
  applyQuestionId: string;  // references Q6 by id
};

export type TutorLessonPayload = {
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
};

export type TutorQuizPayload = {
  title: string;
  intro: string;
  transferConcept: TransferSequence;
  questions: QuizQuestion[];
};

type TutorSuccessBase = {
  ok: true;
  generatedBy: "openai" | "fallback";
  username: string;
  source_url: string;
  films: LetterboxdFilm[] | FilmInput[];
  warning?: string;
};

export type TutorLessonResponse = TutorSuccessBase & {
  mode: "blurb";
  lesson: TutorLessonPayload;
};

export type TutorQuizResponse = TutorSuccessBase & {
  mode: "quiz";
  quiz: TutorQuizPayload;
};

export type TutorResponse =
  | TutorLessonResponse
  | TutorQuizResponse
  | {
      ok: false;
      error: string;
    };
