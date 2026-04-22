import type { FilmInput, TutorLessonPayload, TutorQuizPayload } from "@/lib/film-tutor/types";
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

const scaffoldStepSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    prompt: { type: "string" },
    hint: { type: "string" },
    expectedFocus: { type: "string" },
  },
  required: ["prompt", "hint", "expectedFocus"],
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
                scaffoldSteps: {
                  type: "array",
                  minItems: 2,
                  maxItems: 3,
                  items: scaffoldStepSchema,
                },
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
                revealAnswerAfterFallback: { type: "boolean" },
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
                "scaffoldSteps",
                "fallbackMultipleChoice",
                "revealAnswerAfterFallback",
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
  films: FilmInput[],
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
  films: FilmInput[],
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
  films: FilmInput[],
  wikiContext: Map<string, WikiFilmContext | null>
) {
  const lines = films.map((film, index) => `${index + 1}. ${film.title}`).join("\n");

  return [
    "You are Mise-en-Lens, a beginner-friendly film tutor.",
    "Return JSON only.",
    "Create an 8-question quiz personalized to the user's Top 4 films.",
    "Do not generate lesson content.",
    "Return only: title, intro, transferConcept, questions.",
    "Keep all text concise and beginner-friendly.",
    "",
    "=== QUESTION ARC ===",
    "The 8 questions must follow this progression — identify → interpret → apply → transfer:",
    "",
    "Q1 (multiple_choice): RECOGNITION — one factual question about a Top-4 film drawn from its wiki extract. Ask about director, genre, or setting. Do NOT ask about release year.",
    "Q2 (multiple_choice): RECOGNITION — 'Which of these best describes the tone or mood of [Film A]?' Four plausible options, only one correct. Make distractors genuinely close — do not include obviously wrong tones.",
    "Q3 (short_answer): INTERPRETATION — 'What is one theme in [Film B]?' Ask for a single theme only. Do NOT stack a second task onto this question. maxWords: 14.",
    "Q4 (short_answer): INTERPRETATION — 'Pick a specific scene or moment in [Film B]. What does it show about the character or the film's meaning?' Ask the student to name something concrete and say what it reveals — not what it 'makes them feel' in isolation. maxWords: 18.",
    "Q5 (short_answer): ANALYSIS — 'In [Film C], name one specific visual or storytelling technique. What is the director showing about the character or theme through it?' Ask for technique + what it communicates, not just emotional response. maxWords: 18.",
    "Q6 (multiple_choice, id='q6'): APPLY VERIFY — 'Which of these scenes in [Film A] is an example of [concept]?' Four options: three plausible scene descriptions and one correct. Do NOT copy the teachStatement phrasing — paraphrase so the student has to recognize the concept, not match text.",
    "Q7 (short_answer, id='q7'): APPLY — 'Find [concept] in [Film B] — describe one specific moment or technique where you see it, in one sentence.' Film B must be a different film from Film A. acceptableAnswers and acceptableKeywords must come from Film B's wiki plot and themes. maxWords: 18.",
    "Q8 (short_answer): TRANSFER — 'You've seen [concept] in [Film A] and [Film B]. In both cases, what is the director trying to make you understand or feel?' Ask the student to draw a cross-film conclusion about the concept's purpose — not to list examples again. maxWords: 50.",
    "",
    "=== TRANSFER CONCEPT ===",
    "For transferConcept: pick a concept that genuinely appears in BOTH Film A and Film B according to the wiki context.",
    "transferConcept.teachStatement: 2-3 sentences using only facts from Film A's wiki. Include the concept name, what it looks like in Film A, and one concrete example from the wiki plot or themes. Template: 'In [Film A], [concept] shows up as [technique]. You can see this when [specific scene from wiki].'",
    "transferConcept.verifyQuestionId must be 'q6'. transferConcept.applyQuestionId must be 'q7'.",
    "",
    "=== SCAFFOLD STEPS (for all short_answer questions) ===",
    "Each short_answer question MUST include scaffoldSteps: an array of 2-3 steps that break the question into smaller pieces.",
    "Scaffold step rules:",
    "- Step 1: ask for one small, concrete thing only (e.g. just name a theme, just name a scene). Do NOT ask for interpretation at step 1.",
    "- Step 2: build on step 1 — ask the student to say something about what they named (e.g. what that scene shows, what the film is arguing about that theme).",
    "- Step 3 (optional): ask for a fuller or more precise explanation if step 2 is still too simple for the question.",
    "- Each step's hint must name at least one concrete example the student can use — never write 'think about the film's themes' or 'consider the story.'",
    "- Each step's expectedFocus is a short phrase describing the ideal cognitive move (e.g. 'identifies a named theme', 'connects scene to character arc', 'explains director's intent').",
    "IMPORTANT — tutor behavior when the student is stuck:",
    "- If the student writes 'idk', 'I don't know', leaves it blank, or writes fewer than 4 words: do NOT repeat the main question. Move to the next scaffold step.",
    "- Do NOT show multiple choice until at least 3 failed attempts AND all scaffold steps have been shown.",
    "- revealAnswerAfterFallback: set to true for Q3–Q5 (interpretation), false for Q7–Q8 (apply/transfer — the student should keep trying).",
    "",
    "=== QUESTION-WRITING RULES ===",
    "1. Do not stack two cognitive tasks in one question unless it is the final step of a scaffold sequence.",
    "2. Early scaffold steps ask for one thing only.",
    "3. Require specificity. If the main question prompt asks about a theme, it must also ask the student to name a specific scene, character, or moment — not just the theme word. A one-word answer like 'family' should score as partial, not correct.",
    "4. Do NOT use these phrases: 'why the film cares about it', 'what feeling it creates', 'Think about the film's emotional journey', 'Consider the story.'",
    "5. Use wording like: 'What is the film saying about ___?', 'What does this moment show about the character or theme?', 'Why does this scene matter?', 'What is the director trying to make you understand?'",
    "6. Multiple choice distractors must be plausible and specific — scene descriptions, not abstract labels. Avoid options that are obviously wrong in tone or topic.",
    "",
    "=== FEEDBACK RULES ===",
    "- correctFeedback: one sentence naming exactly what was right about the student's answer. No filler ('Great insight!', 'That resonates deeply', 'Exactly!').",
    "- partialFeedback: name the specific part that was right, then ask ONE targeted refinement question. Example: 'You named the theme — now name one specific scene where the film shows that.' Never generic.",
    "- incorrectFeedback: explain what was missed without giving away the answer.",
    "- hint: must name at least one concrete anchor — a character, scene, or technique the student can hold onto. Never write 'Think about what happens in the film.'",
    "",
    "=== OTHER RULES ===",
    "- Do NOT include a reflection question about what technique the student will look for next time.",
    "- Do NOT ask about release years.",
    "- Never use em dashes in the queston prompts or text.",
    "- acceptableAnswers and acceptableKeywords for short_answer questions must come from the wiki reference context (character names, themes mentioned, plot events, techniques named).",
    "- maxWords for every short_answer must be between 12 and 20. Never below 12.",
    "",
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
  films: FilmInput[],
  wikiContext: Map<string, WikiFilmContext | null>
): Promise<TutorLessonPayload> {
  return generateWithOpenAI<TutorLessonPayload>(buildLessonPrompt(films, wikiContext), lessonSchema);
}

export async function generateQuizWithOpenAI(
  films: FilmInput[],
  wikiContext: Map<string, WikiFilmContext | null>
): Promise<TutorQuizPayload> {
  return generateWithOpenAI<TutorQuizPayload>(buildQuizPrompt(films, wikiContext), quizSchema);
}
