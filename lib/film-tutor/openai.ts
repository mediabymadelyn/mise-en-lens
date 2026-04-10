import type { LetterboxdFilm } from "@/lib/letterboxd/scraper";
import type { TutorLessonPayload, TutorQuizPayload } from "@/lib/film-tutor/types";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_FILM_TUTOR_MODEL || "gpt-4o-mini";

const lessonSchema = {
  name: "film_tutor_lesson",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      headline: { type: "string" },
      overview: { type: "string" },
      tasteProfile: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 4,
      },
      concept: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          explanation: { type: "string" },
          connection: { type: "string" },
        },
        required: ["name", "explanation", "connection"],
      },
      filmNotes: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            artisticElements: { type: "string" },
            societalContext: { type: "string" },
          },
          required: ["title", "summary", "artisticElements", "societalContext"],
        },
      },
      recommendation: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          whyYouMightLikeIt: { type: "string" },
          educationalRedirect: { type: "string" },
        },
        required: ["title", "whyYouMightLikeIt", "educationalRedirect"],
      },
    },
    required: [
      "headline",
      "overview",
      "tasteProfile",
      "concept",
      "filmNotes",
      "recommendation",
    ],
  },
} as const;

const quizSchema = {
  name: "film_tutor_quiz",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      intro: { type: "string" },
      questions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                questionType: { const: "multiple_choice" },
                prompt: { type: "string" },
                focus: { type: "string" },
                hint: { type: "string" },
                explanation: { type: "string" },
                options: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 4,
                },
                correctAnswer: { type: "string" },
                correctFeedback: { type: "string" },
                partialFeedback: { type: "string" },
                incorrectFeedback: { type: "string" },
              },
              required: [
                "id",
                "questionType",
                "prompt",
                "focus",
                "hint",
                "explanation",
                "options",
                "correctAnswer",
                "correctFeedback",
                "partialFeedback",
                "incorrectFeedback",
              ],
            },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                questionType: { const: "short_answer" },
                prompt: { type: "string" },
                focus: { type: "string" },
                hint: { type: "string" },
                explanation: { type: "string" },
                maxWords: { type: "number" },
                placeholder: { type: "string" },
                acceptableAnswers: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 1,
                  maxItems: 6,
                },
                acceptableKeywords: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 10,
                },
                correctFeedback: { type: "string" },
                partialFeedback: { type: "string" },
                incorrectFeedback: { type: "string" },
              },
              required: [
                "id",
                "questionType",
                "prompt",
                "focus",
                "hint",
                "explanation",
                "maxWords",
                "placeholder",
                "acceptableAnswers",
                "acceptableKeywords",
                "correctFeedback",
                "partialFeedback",
                "incorrectFeedback",
              ],
            },
          ],
        },
      },
    },
    required: ["title", "intro", "questions"],
  },
} as const;

function buildLessonPrompt(films: LetterboxdFilm[]) {
  const lines = films.map((film, index) => `${index + 1}. ${film.title}`).join("\n");

  return [
    "You are Mise-en-Lens, a beginner-friendly film tutor.",
    "Return JSON only.",
    "Use the user's Top 4 films as the basis for a short educational lesson.",
    "Be accurate, clear, and warm. If you are not sure about a film-specific fact, stay high-level rather than inventing details.",
    "Explain one film concept in beginner-friendly language and connect it to the user's taste.",
    "For each film note, include a short summary of why it fits their taste, one artistic angle, and one societal or historical angle.",
    "Recommendation should feel like educational redirection, not just similarity.",
    "Top 4:",
    lines,
  ].join("\n");
}

function buildQuizPrompt(films: LetterboxdFilm[]) {
  const lines = films.map((film, index) => `${index + 1}. ${film.title}`).join("\n");

  return [
    "You are Mise-en-Lens, a beginner-friendly film tutor.",
    "Return JSON only.",
    "Create a very lightweight, approachable quiz personalized to the user's Top 4 films.",
    "The quiz must be answerable quickly by a beginner.",
    "Questions must be answerable in under 10 seconds each.",
    "Avoid requiring plot recall, broad essays, polished prose, or deep prior film-theory knowledge.",
    "Prefer recognition over explanation.",
    "Question progression:",
    "1. easy recognition question",
    "2. short guided interpretation",
    "3. brief transfer or reflection question",
    "Use one multiple_choice question first, then short_answer questions with tight scaffolding.",
    "Short answers should allow partial credit from short phrases.",
    "Keep wording clear, short, and beginner-friendly.",
    "Personalize to the user's films without becoming so specific that the quiz becomes fact-fragile.",
    "Top 4:",
    lines,
  ].join("\n");
}

async function generateWithOpenAI<T>(
  input: string,
  schema: typeof lessonSchema | typeof quizSchema
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      store: false,
      input,
      text: {
        format: {
          type: "json_schema",
          ...schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const outputText =
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((part) => part.type === "output_text" && typeof part.text === "string")
      ?.text;

  if (!outputText) {
    throw new Error("OpenAI response did not include parsable text output.");
  }

  return JSON.parse(outputText) as T;
}

export async function generateLessonWithOpenAI(
  films: LetterboxdFilm[]
): Promise<TutorLessonPayload> {
  return generateWithOpenAI<TutorLessonPayload>(buildLessonPrompt(films), lessonSchema);
}

export async function generateQuizWithOpenAI(films: LetterboxdFilm[]): Promise<TutorQuizPayload> {
  return generateWithOpenAI<TutorQuizPayload>(buildQuizPrompt(films), quizSchema);
}
