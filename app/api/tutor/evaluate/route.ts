import type { EvaluateRequest, EvaluateResponse, EvaluateVerdict } from "@/lib/film-tutor/evaluation-types";
import { fetchWikiContextForFilms } from "@/lib/wikipedia/client";

export const runtime = "nodejs";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_FILM_TUTOR_EVAL_MODEL || "gpt-4o-mini";

const evaluationSchema = {
  name: "film_tutor_evaluation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: {
        type: "string",
        enum: ["correct", "partial", "off_base", "concept_question", "memory_gap"],
      },
      feedback: {
        type: "string",
        description: "One sentence. Must reference something specific the student wrote. No filler phrases.",
      },
      nextHint: { type: "string" },
    },
    required: ["verdict", "feedback", "nextHint"],
  },
} as const;

const systemPrompt = `You are evaluating a student's answer to a film analysis question. Your job is to determine if their reasoning is defensible based on the film's Wikipedia context.

## VERDICT CATEGORIES (choose exactly one)

**correct**: The student names a scene/theme/technique AND provides any explanation connecting it to the question — even if informal, brief, or imperfectly worded. If both pieces are present, return correct. Do NOT ask for further elaboration of an explanation that is already there.

**partial**: The student provides ONE piece but is missing the other entirely. Use this ONLY when:
- Names a theme but provides zero scene or example (not even an implicit one)
- Names a scene but provides zero interpretation or connection whatsoever
Do NOT return partial if the student gave both pieces in rough form — that is correct.

**off_base**: The answer is wrong, unrelated, or too vague to evaluate. Cases:
- Gibberish, single unrelated word, or empty response
- "idk", "i don't know", "not sure", "maybe" — student is not attempting an answer
- Mentions events/characters clearly not in the film's Wikipedia entry
- True statement about the film that completely ignores what was asked

**concept_question**: The student is asking for clarification about a term in the question itself (e.g., "what is a technique?", "give me an example of a theme", "what does that mean"). DO NOT treat this as an answer attempt.

**memory_gap**: The student explicitly says they haven't seen the film or can't remember the plot — NOT just that they don't know the answer. Phrases like "i haven't seen it", "i forgot the whole film", "didn't watch it", "don't remember the movie." DO NOT treat this as an answer attempt. NOTE: "i don't know" or "idk" alone is NOT a memory gap — it is off_base.

## EVALUATION RULES

1. **For interpretation/analysis questions**: There is no single right answer. ANY scene or theme supported by Wikipedia counts as correct IF the student provides any explanation — however brief — connecting it to the question. Do not require a formally articulated answer.

2. **The bar for correct is low on interpretation questions**: If the student names a scene AND says anything about why it matters, what it shows, or how it connects to the theme — that is correct. Examples of things that ARE enough: "it showed how much he cared", "it reveals their friendship", "it made them feel scared", "because of racism". These all count.

3. **Do not keep asking for more once both pieces are present**: If the student has provided both an identifying element (scene, theme, technique) and any reasoning (however rough), return correct. Only return partial if one of the two is genuinely absent.

4. **Wikipedia is ground truth**: If the student's specific factual claim isn't supported by the plot summary or themes section, it's off_base.

5. **One sentence feedback**: Must reference something specific the student wrote. No filler phrases like "Great job!" or "Keep thinking!" or "That's a great observation!"

## REASONING CHECKLIST (think through before deciding)

Before choosing a verdict, ask yourself:
1. Did the student name a specific scene, theme, or technique? (yes/no)
2. Did the student provide ANY explanation — even one clause — connecting it to the question? (yes/no)
3. If both answers are yes → correct.
4. If only one is yes → partial.
5. If neither → off_base.
6. Is this a clarifying question about what a word in the prompt means → concept_question?
7. Is this explicitly about not having seen or not remembering the film → memory_gap?

## EXAMPLES

**Example 1:**
Question: "Name a scene in Ponyo that shows friendship"
Student: "when sauske and ponyo were on the boat it showed friendship"
Verdict: correct
Feedback: "The boat scene with Sōsuke and Ponyo does demonstrate their friendship."

**Example 2 (correct — informal explanation counts):**
Question: "Pick a specific scene in Ponyo. What does it show about the character or the film's meaning?"
Student: "when ponyo and sosuke go on the boat it revealed how much he cared and how much he put on the line to be with her"
Verdict: correct
Feedback: "You identified the boat scene and explained what it shows about Sōsuke's character — that works."

**Example 3 (correct — rough transfer answer counts):**
Question: "You've seen character development in Juno and Get Out. What is the director trying to make you understand?"
Student: "in juno giving away the baby and in get out becoming more weary and understanding the impacts of racism"
Verdict: correct
Feedback: "You named specific turning points in both films and connected them to what each character learns — that's the transfer."

**Example 4:**
Question: "How does Little Miss Sunshine explore family dynamics?"
Student: "when olive wanted to become a beauty queen and was sad"
Verdict: partial
Feedback: "You've identified Olive's storyline, but how does that scene show family dynamics — what do the other family members do?"
NextHint: "Describe how the family reacts to Olive's dream or how they support her."

**Example 5:**
Question: "Identify a cinematic technique in Juno"
Student: "what is a technique"
Verdict: concept_question
Feedback: "A cinematic technique is a tool filmmakers use—like close-ups, lighting, music choices, or editing styles."

**Example 6:**
Question: "What theme appears in Spirited Away?"
Student: "i don't remember this movie"
Verdict: memory_gap
Feedback: "That's okay — use the hint below to refresh your memory about the film's plot."

**Example 7:**
Question: "What theme appears in Spirited Away?"
Student: "idk"
Verdict: off_base
Feedback: "Give it a try — even a rough guess based on what you remember is worth attempting."

**Example 8:**
Question: "Analyze the use of color in Amélie"
Student: "pizza"
Verdict: off_base
Feedback: "Your answer doesn't address the question about color in Amélie."

**Example 9:**
Question: "How does Moonlight explore identity?"
Student: "moonlight is about identity"
Verdict: partial
Feedback: "You've named the theme — now name one specific scene or moment where that plays out."
NextHint: "Think about a moment where Chiron's sense of self is challenged or revealed."

## YOUR TASK

Given the question, student answer, and Wikipedia context below, determine the verdict and write specific feedback. Respond ONLY with valid JSON matching the required schema.`;

type WikiFields = { extract: string; plot?: string; themes?: string };

function buildUserPrompt(req: EvaluateRequest, wikiFields: WikiFields | null): string {
  const historyText =
    req.priorTurns.length > 0
      ? req.priorTurns.map((t) => `${t.role}: ${t.text}`).join("\n")
      : "This is the first attempt.";

  return [
    "QUESTION DETAILS:",
    `- Focus: ${req.question.focus}`,
    `- Prompt: "${req.question.prompt}"`,
    `- Hint available: "${req.question.hint}"`,
    "",
    `WIKIPEDIA CONTEXT FOR ${req.filmInFocus}:`,
    `Extract: ${wikiFields?.extract ?? "Not available"}`,
    `Plot: ${wikiFields?.plot ?? "Not available"}`,
    `Themes: ${wikiFields?.themes ?? "Not available"}`,
    "",
    "STUDENT ANSWER:",
    `"${req.studentAnswer}"`,
    "",
    "CONVERSATION HISTORY (prior attempts for this question):",
    historyText,
    "",
    "Evaluate this answer and respond with JSON only.",
  ].join("\n");
}

function heuristicFallback(req: EvaluateRequest): EvaluateResponse {
  const answer = req.studentAnswer.trim().toLowerCase();

  if (!answer || answer.split(/\s+/).filter(Boolean).length < 2) {
    return { ok: true, verdict: "off_base", feedback: "Give me one sentence and we can build from there." };
  }

  const memoryPhrases = [
    "i dont remember", "i don't remember", "i can't remember", "i cant remember",
    "i haven't seen", "i havent seen", "i don't recall", "i dont recall",
    "i forget", "i forgot", "never seen", "haven't watched", "havent watched",
  ];
  if (memoryPhrases.some((p) => answer.includes(p))) {
    return { ok: true, verdict: "memory_gap", feedback: "That's fine — use the hint below as a starting point." };
  }

  const conceptPhrases = ["what is a", "what's a", "what is the", "what does", "define ", "give me an example"];
  if (conceptPhrases.some((p) => answer.includes(p))) {
    return { ok: true, verdict: "concept_question", feedback: "Check the hint below for a definition, then try answering." };
  }

  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  const keywordHits = req.question.acceptableKeywords.filter((k) => answer.includes(k.toLowerCase())).length;
  const acceptableHit = req.question.acceptableAnswers.some((a) => answer.includes(a.toLowerCase()));

  if (wordCount >= 5 && (acceptableHit || keywordHits >= 1)) {
    return { ok: true, verdict: "correct", feedback: "Good — that connects to the film." };
  }
  if (acceptableHit || keywordHits >= 1) {
    return { ok: true, verdict: "partial", feedback: "You named it — now add one specific scene or moment.", nextHint: "Name one scene where that appears in the film." };
  }
  if (wordCount >= 5) {
    return { ok: true, verdict: "partial", feedback: "Try connecting your answer to a specific moment in the film.", nextHint: "Name one character or scene to ground your answer." };
  }

  return { ok: true, verdict: "off_base", feedback: "Write one full sentence about the film.", nextHint: "Try: 'In one scene, [character] does [something], which shows [idea].'" };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EvaluateRequest;
    const { question, studentAnswer, priorTurns, films, filmInFocus } = body;

    if (!question || !studentAnswer || !filmInFocus) {
      return Response.json({ ok: false, error: "Missing required fields." } satisfies EvaluateResponse, { status: 400 });
    }

    // Fetch wiki context — filmInFocus first, then others up to Top 4
    const titlesToFetch = [filmInFocus, ...films.map((f) => f.title).filter((t) => t !== filmInFocus)].slice(0, 4);
    let wikiFields: WikiFields | null = null;
    try {
      const wikiContext = await fetchWikiContextForFilms(titlesToFetch);
      const ctx = wikiContext.get(filmInFocus);
      if (ctx) {
        wikiFields = { extract: ctx.extract, plot: ctx.plot ?? undefined, themes: ctx.themes ?? undefined };
      }
    } catch {
      // Proceed without wiki — heuristic fallback will handle if OpenAI also fails
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(heuristicFallback(body), { status: 200 });
    }

    console.log("=== EVALUATION REQUEST ===");
    console.log("Question focus:", question.focus);
    console.log("Question prompt:", question.prompt);
    console.log("Student answer:", studentAnswer);
    console.log("Attempts so far:", priorTurns.length);

    const userPrompt = buildUserPrompt({ question, studentAnswer, priorTurns, films, filmInFocus }, wikiFields);

    try {
      const response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          store: false,
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          text: {
            format: {
              type: "json_schema",
              ...evaluationSchema,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Evaluation OpenAI request failed: ${response.status} ${errorText}`);
        return Response.json(heuristicFallback(body), { status: 200 });
      }

      const payload = (await response.json()) as {
        output_text?: string;
        output?: Array<{
          content?: Array<{ type?: string; text?: string }>;
        }>;
      };

      const outputText =
        payload.output_text ??
        payload.output
          ?.flatMap((item) => item.content ?? [])
          .find((part) => part.type === "output_text" && typeof part.text === "string")
          ?.text;

      if (!outputText) {
        return Response.json(heuristicFallback(body), { status: 200 });
      }

      const result = JSON.parse(outputText) as {
        verdict: EvaluateVerdict;
        feedback: string;
        nextHint: string;
      };

      console.log("=== EVALUATION RESULT ===");
      console.log("Verdict:", result.verdict);
      console.log("Feedback:", result.feedback);
      if (result.nextHint) console.log("Next hint:", result.nextHint);
      console.log("========================\n");

      const successResponse: EvaluateResponse = {
        ok: true,
        verdict: result.verdict,
        feedback: result.feedback,
        ...(result.nextHint ? { nextHint: result.nextHint } : {}),
      };
      return Response.json(successResponse, { status: 200 });

    } catch (err) {
      console.error("Evaluation OpenAI call threw:", err);
      return Response.json(heuristicFallback(body), { status: 200 });
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "Evaluation failed.";
    return Response.json({ ok: false, error: message } satisfies EvaluateResponse, { status: 500 });
  }
}
