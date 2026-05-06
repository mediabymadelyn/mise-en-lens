import type { EvaluateRequest, EvaluateResponse } from "@/lib/film-tutor/evaluation-types";
import { filterAcceptableKeywords } from "@/lib/film-tutor/keyword-filter";

export function heuristicFallback(req: EvaluateRequest): EvaluateResponse {
  const answer = req.studentAnswer.trim().toLowerCase();

  if (!answer) {
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
  const filteredKeywords = filterAcceptableKeywords(req.question.acceptableKeywords);
  const keywordHits = filteredKeywords.filter((k) => answer.includes(k.toLowerCase())).length;
  const acceptableHit = req.question.acceptableAnswers.some((a) => answer.includes(a.toLowerCase()));

  // Any keyword or acceptable-answer match routes to partial/correct — never off_base,
  // even if the answer is a single word.
  if (acceptableHit || keywordHits >= 1) {
    if (wordCount >= 5) {
      return { ok: true, verdict: "correct", feedback: "Good — that connects to the film." };
    }
    return { ok: true, verdict: "partial", feedback: "You're on the right track — now say one specific scene or moment where that shows up in the film.", nextHint: "Name one scene where that appears in the film." };
  }

  if (wordCount < 2) {
    return { ok: true, verdict: "off_base", feedback: "Give me one sentence and we can build from there." };
  }

  if (wordCount >= 5) {
    return { ok: true, verdict: "partial", feedback: "Try connecting your answer to a specific moment in the film.", nextHint: "Name one character or scene to ground your answer." };
  }

  return { ok: true, verdict: "off_base", feedback: "Write one full sentence about the film.", nextHint: "Try: 'In one scene, [character] does [something], which shows [idea].'" };
}
