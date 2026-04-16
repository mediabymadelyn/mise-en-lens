import type { LetterboxdFilm } from "@/lib/letterboxd/scraper";
import type { TutorLessonPayload, TutorQuizPayload } from "@/lib/film-tutor/types";
import type { WikiFilmContext } from "@/lib/wikipedia/client";

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
      transferConcept: {
        type: "object",
        additionalProperties: false,
        properties: {
          concept: { type: "string" },
          fromFilm: { type: "string" },
          applyToFilm: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["concept", "fromFilm", "applyToFilm", "explanation"],
      },
      questions: {
        type: "array",
        minItems: 8,
        maxItems: 8,
        items: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                questionType: { type: "string", enum: ["multiple_choice"] },
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
                questionType: { type: "string", enum: ["short_answer"] },
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
    required: ["title", "intro", "transferConcept", "questions"],
  },
} as const;

function buildWikiReferenceBlock(
  films: LetterboxdFilm[],
  wikiContext: Map<string, WikiFilmContext | null>
): string {
  const blocks: string[] = [];
  for (const film of films) {
    const ctx = wikiContext.get(film.title);
    if (!ctx) continue;
    const parts = [`Reference context for "${film.title}":\n${ctx.extract}`];
    if (ctx.plot) parts.push(`Plot synopsis:\n${ctx.plot}`);
    if (ctx.themes) parts.push(`Themes:\n${ctx.themes}`);
    blocks.push(parts.join("\n\n"));
  }
  if (blocks.length === 0) return "";
  return (
    "\n\nUse the reference context below for factual grounding. Do not invent plot details, director names, release years, or cast information that is not supported by the reference context or your confident knowledge.\n\n" +
    blocks.join("\n\n---\n\n")
  );
}

function buildLessonPrompt(
  films: LetterboxdFilm[],
  wikiContext: Map<string, WikiFilmContext | null>
) {
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
    buildWikiReferenceBlock(films, wikiContext),
  ].join("\n");
}

function buildQuizPrompt(
  films: LetterboxdFilm[],
  wikiContext: Map<string, WikiFilmContext | null>
) {
  const lines = films.map((film, index) => `${index + 1}. ${film.title}`).join("\n");

  return [
    "You are Mise-en-Lens, a beginner-friendly film tutor.",
    "Return JSON only.",
    "Create a lightweight 8-question quiz personalized to the user's Top 4 films.",
    "Do not generate lesson content.",
    "Return only: title, intro, transferConcept, questions.",
    "Keep all text concise and beginner-friendly.",
    "Question mix: 3 multiple_choice and 5 short_answer.",
    "Short-answer prompts must request one sentence max.",
    "Progression:",
    "Q1-Q2 very easy recognition (multiple choice).",
    "Q3-Q5 guided interpretation with clear scaffolding.",
    "Q6-Q7 transfer: apply an idea from one film to a different film.",
    "Q8 short reflection (one sentence max).",
    "Before Q6, include transferConcept with 1-2 sentence explanation tied to one film and applied to another film.",
    "Avoid long explanations, deep theory, and plot-fragile trivia.",
    "For each question include concise hint, explanation, and feedback strings.",
    "Feedback behavior: vague/idk -> simpler follow-up question; partial -> acknowledge + one refinement question; correct -> brief confirmation + one-sentence expansion.",
    "For short_answer questions, populate acceptableAnswers and acceptableKeywords using factual details from the reference context (character names, director names, specific themes, years, techniques mentioned).",
    "Top 4:",
    lines,
    buildWikiReferenceBlock(films, wikiContext),
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
  films: LetterboxdFilm[],
  wikiContext: Map<string, WikiFilmContext | null>
): Promise<TutorLessonPayload> {
  return generateWithOpenAI<TutorLessonPayload>(buildLessonPrompt(films, wikiContext), lessonSchema);
}

export async function generateQuizWithOpenAI(
  films: LetterboxdFilm[],
  wikiContext: Map<string, WikiFilmContext | null>
): Promise<TutorQuizPayload> {
  return generateWithOpenAI<TutorQuizPayload>(buildQuizPrompt(films, wikiContext), quizSchema);
}
