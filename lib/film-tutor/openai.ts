import type { FilmInput, TutorLessonPayload, TutorQuizPayload } from "@/lib/film-tutor/types";
import type { QuizQuestion } from "@/lib/film-tutor/types";
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
          posterUrl: { type: ["string", "null"] },
          filmUrl: { type: ["string", "null"] },
        },
        required: ["title", "whyYouMightLikeIt", "educationalRedirect", "posterUrl", "filmUrl"],
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
        minItems: 9,
        maxItems: 9,
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
              anyOf: [
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
                  ],
                },
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
    "Create a 9-question quiz personalized to the user's Top 4 films.",
    "Do not generate lesson content.",
    "Return only: title, intro, transferConcept, questions.",
    "Keep all text concise and beginner-friendly.",
    "",
    "=== QUESTION ARC ===",
    "The 9 questions follow a 5-section progression: warm up → interpret → compare → apply → reflect.",
    "",
    "SECTION 1 — Warm-Up (Q1, Q2): multiple_choice",
    "- Analytical, not trivia. 4 plausible options, one strongest.",
    "- Tests meaning, symbolism, technique, relationships, or tone.",
    "- NO: release dates, actor names, plot recall, joke distractors.",
    "- Example stems: 'What does ___ most likely symbolize in ___?', 'How does the director use cinematography in ___ to reinforce the story themes?', 'What does the ending of ___ most strongly suggest?'",
    "- Distractors must be plausible and close. Never obviously wrong.",
    "",
    "SECTION 2 — Interpretation (Q3, Q4): short_answer",
    "- Require evidence. Multiple defensible answers allowed.",
    "- Must NOT duplicate the topic of Q1 or Q2.",
    "- Specific, not vague. NOT yes/no, NOT 'did you like it', NOT 'what happened'.",
    "- Example stems: 'What do you think ___ is saying about ___? Name one specific moment.', 'Why do you think ___ makes this decision, and what does it reveal about them?', 'How does the use of [lighting / music / framing] shape your understanding of the story?'",
    "- maxWords: 18.",
    "",
    "SECTION 3 — Compare/Contrast (Q5, Q6): short_answer",
    "- Pick TWO of the user's Top-4 films that share an identifiable concept (theme, technique, tone, or character arc). State the concept in the prompt.",
    "- Example stems: 'How does [Film A] portray ambition differently than [Film B]?', 'Which film communicates loneliness more through visuals: [Film A] or [Film B]? Name one moment.', 'Compare the conflict in [Film A] to [Film B]. What changes?'",
    "- maxWords: 20.",
    "- focus: 'Compare'",
    "- There is no single correct answer for compare questions — do not grade as right/wrong.",
    "",
    "SECTION 4 — Transfer / Application (Q7, Q8):",
    "Q7 (multiple_choice, id='q7'): APPLY VERIFY — 'Which of these scenes in [Film A] is an example of [concept]?' Paraphrase options — do not copy the teachStatement.",
    "Q8 (short_answer, id='q8'): APPLY — 'Find [concept] in [Film B] — describe one specific moment or technique, in one sentence.' Film B must differ from Film A. acceptableAnswers/acceptableKeywords from Film B's wiki plot and themes. maxWords: 18.",
    "",
    "SECTION 5 — Reflection (Q9): short_answer",
    "- ONE question. Personal, lightweight, approachable.",
    "- Example stems: 'Which moment affected you the most, and how did the film create that impact?', 'Has your interpretation changed during this quiz? Why?'",
    "- maxWords: 25.",
    "- focus: 'Reflection'",
    "- This question has no correct answer — do not set revealAnswerAfterFallback. Omit fallbackMultipleChoice.",
    "",
    "=== TRANSFER CONCEPT ===",
    "For transferConcept: pick a concept that genuinely appears in BOTH Film A and Film B according to the wiki context.",
    "transferConcept.teachStatement: 2-3 sentences using only facts from Film A's wiki. Include the concept name, what it looks like in Film A, and one concrete example from the wiki plot or themes. Template: 'In [Film A], [concept] shows up as [technique]. You can see this when [specific scene from wiki].'",
    "transferConcept.verifyQuestionId must be 'q7'. transferConcept.applyQuestionId must be 'q8'.",
    "",
    "=== SCAFFOLD STEPS (for all short_answer questions) ===",
    "Each short_answer question MUST include scaffoldSteps: an array of 2-3 steps.",
    "Scaffold step rules:",
    "- Step 1: ask for one small, concrete thing only. Do NOT ask for interpretation at step 1.",
    "- Step 2: build on step 1 — ask the student to say something about what they named.",
    "- Step 3 (optional): ask for a fuller explanation if step 2 is still too simple.",
    "- Each step's hint must name at least one concrete example. Never write 'think about the film's themes' or 'consider the story.'",
    "- Each step's expectedFocus is a short phrase describing the ideal cognitive move.",
    "",
    "=== TUTOR BEHAVIOR RULES ===",
    "- When a student says 'idk' or gives a vague answer, ASK WHAT FEELS UNCLEAR before moving to the next scaffold step. Do not silently advance.",
    "- Never reveal the correct answer on multiple choice after one wrong attempt.",
    "- For reflection and compare questions, there is no single correct answer — do not grade them as right/wrong.",
    "- When giving feedback on a partial answer, name the specific part that was right before asking for more.",
    "- Remove filler feedback ('Great insight!', 'That resonates deeply', 'Exactly!'). Feedback must name something specific.",
    "",
    "=== QUESTION-WRITING RULES ===",
    "1. Do not stack two cognitive tasks in one question unless it is the final step of a scaffold sequence.",
    "2. Early scaffold steps ask for one thing only.",
    "3. Require specificity. A one-word answer like 'family' should score as partial, not correct.",
    "4. Do NOT use these phrases: 'why the film cares about it', 'what feeling it creates', 'Think about the film's emotional journey', 'Consider the story.'",
    "5. Use wording like: 'What is the film saying about ___?', 'What does this moment show about the character or theme?', 'What is the director trying to make you understand?'",
    "6. Multiple choice distractors must be plausible and specific — scene descriptions, not abstract labels.",
    "",
    "=== FEEDBACK RULES ===",
    "- correctFeedback: one sentence naming exactly what was right. No filler.",
    "- partialFeedback: name the specific part that was right, then ask ONE targeted refinement question.",
    "- incorrectFeedback: explain what was missed without giving away the answer.",
    "- hint: must name at least one concrete anchor — a character, scene, or technique.",
    "",
    "=== OTHER RULES ===",
    "- Do NOT ask about release years.",
    "- Never use em dashes in question prompts or text.",
    "- acceptableAnswers and acceptableKeywords must come from the wiki reference context.",
    "- maxWords for every short_answer must be between 12 and 25. Never below 12.",
    "- Q5 and Q6 focus must be 'Compare'. Q9 focus must be 'Reflection'.",
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

function findMentionedFilmTitles(text: string, filmTitles: string[]): string[] {
  const lower = text.toLowerCase();
  return filmTitles.filter((title) => lower.includes(title.toLowerCase()));
}

function normalizeQuizHintCoherence(quiz: TutorQuizPayload, films: FilmInput[]): TutorQuizPayload {
  const filmTitles = films.map((f) => f.title);

  const questions: QuizQuestion[] = quiz.questions.map((question) => {
    if (question.questionType !== "multiple_choice") return question;

    const promptMentions = findMentionedFilmTitles(question.prompt, filmTitles);
    const hintMentions = findMentionedFilmTitles(question.hint, filmTitles);

    // Target only obvious cross-film drift on single-film MC questions.
    if (promptMentions.length !== 1) return question;
    if (hintMentions.length <= 1) return question;

    const promptFilm = promptMentions[0];
    if (hintMentions.every((title) => title === promptFilm)) return question;

    return {
      ...question,
      hint: `Think about a concrete moment in ${promptFilm} that best supports your choice.`,
    };
  });

  return {
    ...quiz,
    questions,
  };
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
  const quiz = await generateWithOpenAI<TutorQuizPayload>(buildQuizPrompt(films, wikiContext), quizSchema);
  return normalizeQuizHintCoherence(quiz, films);
}
