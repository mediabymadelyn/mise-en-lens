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
      feedback: { type: "string" },
      nextHint: { type: "string" },
    },
    required: ["verdict", "feedback", "nextHint"],
  },
} as const;

function buildEvaluationPrompt(req: EvaluateRequest, wikiExtract: string): string {
  const turns = req.priorTurns
    .map((t) => `${t.role === "tutor" ? "Tutor" : "Student"}: ${t.text}`)
    .join("\n");

  return [
    "You are Mise-en-Lens, a beginner-friendly film tutor evaluating a student's short-answer response.",
    "Return JSON only.",
    "",
    `QUESTION: ${req.question.prompt}`,
    `QUESTION FOCUS: ${req.question.focus}`,
    `FILM IN FOCUS: ${req.filmInFocus}`,
    "",
    wikiExtract
      ? `WIKIPEDIA CONTEXT (use this for factual grounding):\n${wikiExtract}`
      : "No Wikipedia context available — evaluate based on general film knowledge.",
    "",
    "CONVERSATION SO FAR:",
    turns,
    `Student: ${req.studentAnswer}`,
    "",
    "EVALUATION RULES:",
    "1. If the student asks a clarifying question about a concept (e.g., 'what is a technique', 'what does that mean', 'give me an example', 'what is a theme'), return verdict 'concept_question' with feedback as a short one-sentence definition. Do NOT count this as an attempt.",
    "2. If the student says they don't remember the film or haven't seen it, return verdict 'memory_gap' with supportive feedback pointing toward the hint. Do NOT count this as an attempt.",
    "3. For interpretation and analysis questions (focus: Interpretation, Analysis, Apply, Transfer), ANY answer that is textually defensible given the wiki context counts as correct. Do not require the student to match a specific answer — there isn't one.",
    "4. A scene or moment counts as valid if the wiki plot or themes support it showing what the student claims. Example: if the student says 'the boat scene shows friendship because they help each other', and the wiki confirms those characters travel together and friendship is a theme, mark it correct.",
    "5. If the student names a valid theme or technique but does not elaborate when elaboration was asked for (the question prompt requires both identification AND reasoning), return 'partial' with a nextHint asking for the specific missing piece — e.g., 'You named the theme — now name one specific scene where the film shows that.'",
    "6. If the answer is genuinely off-topic (unrelated to the film, gibberish), return 'off_base'.",
    "7. If the answer is vague or too short to evaluate ('idk', 'not sure', one-word non-answer with no connection to the film), return 'off_base'.",
    "8. feedback must be ONE sentence. It must reference something specific the student wrote. Never use filler phrases ('Great job!', 'That's a deep insight!', 'Exactly!'). If correct, say what was right. If partial, name what's right and what's still missing.",
    "9. nextHint: if verdict is 'partial' or 'off_base', provide a one-sentence directional hint that names a concrete anchor (a character, scene, or technique). Otherwise return an empty string.",
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
    let wikiExtract = "";
    try {
      const wikiContext = await fetchWikiContextForFilms(titlesToFetch);
      const ctx = wikiContext.get(filmInFocus);
      if (ctx) {
        const parts = [ctx.extract];
        if (ctx.plot) parts.push(`Plot synopsis:\n${ctx.plot}`);
        if (ctx.themes) parts.push(`Themes:\n${ctx.themes}`);
        wikiExtract = parts.join("\n\n");
      }
    } catch {
      // Proceed without wiki — heuristic fallback will handle if OpenAI also fails
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(heuristicFallback(body), { status: 200 });
    }

    const prompt = buildEvaluationPrompt({ question, studentAnswer, priorTurns, films, filmInFocus }, wikiExtract);

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
          input: prompt,
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
