import type { LetterboxdFilm } from "@/lib/letterboxd/scraper";
import type { TutorMode, TutorPayload } from "@/lib/film-tutor/types";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_FILM_TUTOR_MODEL || "gpt-4o-mini";

const tutorSchema = {
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
      quiz: {
        type: "object",
        additionalProperties: false,
        properties: {
          intro: { type: "string" },
          questions: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                prompt: { type: "string" },
                focus: { type: "string" },
                hint: { type: "string" },
                expectedAnswer: { type: "string" },
                acceptableKeywords: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 8,
                },
                correctFeedback: { type: "string" },
                partialFeedback: { type: "string" },
                incorrectFeedback: { type: "string" },
              },
              required: [
                "id",
                "prompt",
                "focus",
                "hint",
                "expectedAnswer",
                "acceptableKeywords",
                "correctFeedback",
                "partialFeedback",
                "incorrectFeedback",
              ],
            },
          },
        },
        required: ["intro", "questions"],
      },
    },
    required: [
      "headline",
      "overview",
      "tasteProfile",
      "concept",
      "filmNotes",
      "recommendation",
      "quiz",
    ],
  },
} as const;

function buildPrompt(films: LetterboxdFilm[], mode: TutorMode) {
  const lines = films.map((film, index) => `${index + 1}. ${film.title}`).join("\n");

  return [
    "You are Mise-en-Lens, a beginner-friendly film tutor.",
    "Return JSON only.",
    "Use the user's Top 4 films as the basis for a short educational lesson.",
    "Be accurate, clear, and warm. If you are not sure about a film-specific fact, stay high-level rather than inventing details.",
    "Explain one film concept in beginner-friendly language and connect it to the user's taste.",
    "For each film note, include a short summary of why it fits their taste, one artistic angle, and one societal or historical angle.",
    "Recommendation should feel like educational redirection, not just similarity.",
    "Quiz questions must be personalized to the user's specific films and should test artistic choices, context, and interpretation.",
    `Requested emphasis: ${mode === "quiz" ? "prioritize scaffolding for quiz mode" : "prioritize the blurb while still returning the quiz object"}.`,
    "Top 4:",
    lines,
  ].join("\n");
}

export async function generateLessonWithOpenAI(
  films: LetterboxdFilm[],
  mode: TutorMode
): Promise<TutorPayload> {
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
      reasoning: { effort: "low" },
      store: false,
      input: buildPrompt(films, mode),
      text: {
        format: {
          type: "json_schema",
          ...tutorSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as { output_text?: string };
  const outputText = payload.output_text;

  if (!outputText) {
    throw new Error("OpenAI response did not include output_text.");
  }

  return JSON.parse(outputText) as TutorPayload;
}
