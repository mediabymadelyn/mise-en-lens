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
          filmA: { type: "string" },
          filmB: { type: "string" },
          teachStatement: { type: "string" },
          verifyQuestionId: { type: "string" },
          applyQuestionId: { type: "string" },
        },
        required: ["concept", "filmA", "filmB", "teachStatement", "verifyQuestionId", "applyQuestionId"],
      },
      questions: {
        type: "array",
        minItems: 6,
        maxItems: 6,
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
                maxWords: { type: "number", minimum: 12, maximum: 20 },
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
                scaffoldQuestion: { type: "string" },
                scaffoldHint: { type: "string" },
                fallbackMultipleChoice: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    prompt: { type: "string" },
                    options: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 3,
                      maxItems: 3,
                    },
                    correctAnswer: { type: "string" },
                    explanation: { type: "string" },
                  },
                  required: ["prompt", "options", "correctAnswer", "explanation"],
                },
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
                "scaffoldQuestion",
                "scaffoldHint",
                "fallbackMultipleChoice",
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
    "Create a 6-question quiz personalized to the user's Top 4 films.",
    "Do not generate lesson content.",
    "Return only: title, intro, transferConcept, questions.",
    "Keep all text concise and beginner-friendly.",
    "Exactly 6 questions, in this order:",
    "Q1 (multiple_choice): Recognition — one easy fact about a Top-4 film from its wiki extract. Ask something like 'Who directed X?' or 'What genre is X?' — NOT release year trivia.",
    "Q2 (multiple_choice): Recognition — 'Which of these describes the mood/tone of [Film A]?' Four options that are all plausible-sounding; only one matches.",
    "Q3 (short_answer): Guided interpretation — 'Name one theme in [Film B] and say why the film cares about it, in one sentence.' maxWords: 15.",
    "Q4 (short_answer): Guided interpretation — 'Pick one specific moment or technique in [Film C] and say what feeling it creates, in one sentence.' maxWords: 18.",
    "Q5 (multiple_choice, id='q5'): Transfer VERIFY — 'Which of these in [Film A] is an example of [concept]?' Four options: three plausible distractors and one correct answer that directly matches the teachStatement. The correct answer must reference something explicitly mentioned in the teachStatement.",
    "Q6 (short_answer, id='q6'): Transfer APPLY — 'Now find [concept] in [Film B] — name one specific moment or technique, in one sentence.' maxWords: 18. Film B must be a different film from Film A. acceptableAnswers and acceptableKeywords must come from Film B's wiki plot and themes sections.",
    "For transferConcept: pick a concept that genuinely appears in BOTH Film A and Film B according to the wiki context.",
    "transferConcept.teachStatement: 2-3 sentences using only facts from Film A's wiki. Include: the concept name, what it looks like in Film A, and one concrete example from Film A's wiki plot or themes. Template: 'In [Film A], [concept] shows up as [technique]. You can see this when [specific scene or element from wiki].'",
    "transferConcept.verifyQuestionId must be 'q5'. transferConcept.applyQuestionId must be 'q6'.",
    "Do NOT include a reflection question ('what technique will you look for next time').",
    "Do NOT ask about release years or other fact-retrieval trivia.",
    "For each question include concise hint, explanation, and feedback strings.",
    "Feedback behavior: vague/idk -> simpler follow-up; partial -> acknowledge + one refinement; correct -> brief confirmation.",
    "For short_answer questions, populate acceptableAnswers and acceptableKeywords using factual details from the reference context (character names, director names, specific themes, techniques mentioned).",
    "For every short_answer question, maxWords must be between 12 and 20 — enough for one full sentence with a concrete example. Never set maxWords below 12.",
    "For each short_answer question, generate: scaffoldQuestion (a simpler first-step version — e.g. if the main question asks for a theme AND why, the scaffold asks only to name one theme), scaffoldHint (one sentence guiding toward the scaffold answer), and fallbackMultipleChoice (3 options testing the same concept, with correctAnswer and explanation shown after they answer).",
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
