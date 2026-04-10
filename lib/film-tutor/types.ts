import type { LetterboxdFilm } from "@/lib/letterboxd/scraper";

export type TutorMode = "blurb" | "quiz";

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

export type ShortAnswerQuestion = QuizQuestionBase & {
  questionType: "short_answer";
  maxWords: number;
  placeholder: string;
  acceptableAnswers: string[];
  acceptableKeywords: string[];
};

export type QuizQuestion = MultipleChoiceQuestion | ShortAnswerQuestion;

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
  questions: QuizQuestion[];
};

type TutorSuccessBase = {
  ok: true;
  generatedBy: "openai" | "fallback";
  username: string;
  source_url: string;
  films: LetterboxdFilm[];
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
