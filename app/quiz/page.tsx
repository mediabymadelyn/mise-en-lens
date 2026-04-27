"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { EvaluateRequest, EvaluateResponse, EvaluateVerdict } from "@/lib/film-tutor/evaluation-types";
import type {
  FilmInput,
  QuizQuestion,
  TutorQuizResponse,
  TutorResponse,
} from "@/lib/film-tutor/types";

type Top4Response =
  | {
      ok: true;
      username: string;
      source_url: string;
      films: Array<{
        title: string;
        film_url: string | null;
        poster_url: string | null;
      }>;
      warning?: string;
    }
  | {
      ok: false;
      error: string;
      films: [];
      username?: string;
    };

// Per-question state machine statuses
type QuestionStatus = "idle" | "correct" | "partial" | "confused" | "revealed" | "exhausted";

const QUIZ_STORAGE_VERSION = 1;

const SECTION_BY_INDEX = [
  "Warm-Up", "Warm-Up",
  "Interpretation", "Interpretation",
  "Compare", "Compare",
  "Transfer", "Transfer",
  "Reflection",
] as const;

type TutorTurn = {
  role: "tutor" | "user";
  text: string;
};

// Definitions shown when a user asks "what is a [concept]" instead of attempting an answer.
// These responses don't count as attempts.
const CONCEPT_DEFINITIONS: Record<string, string> = {
  theme:
    "A theme is the big idea a film keeps returning to — not the plot, but the subject underneath it. Family, identity, power, loss, belonging. Try: 'It explores [one word] because [one reason the film keeps coming back to it].'",
  technique:
    "A film technique is a deliberate choice the director makes — how close the camera is (framing), what you hear (sound design, silence), what colors appear, how fast scenes cut. Pick one you can actually point to on screen.",
  moment:
    "A moment just means one specific scene or shot that stood out — something that happened on screen, not a summary of the whole film. You don't need a technical term to name it.",
  scene:
    "A scene is a specific sequence of moments on screen where characters interact, something happens, or a visual moment stands out. Name it by who's in it or what happens: 'when Juno talks to her dad' or 'the opening shot in the car'.",
  mood:
    "Mood is the overall feeling the film creates — tense, warm, melancholic, unsettling. Think about how you felt watching it, not what the plot was.",
  tone:
    "Tone is how the film 'speaks' — serious, playful, cold, urgent. It's the emotional atmosphere the director builds through visual and sound choices.",
  symbol:
    "A symbol is an object, color, or image that represents a bigger idea. Example: a mirror might symbolize self-reflection, or the color red might symbolize danger or passion. Connect it: 'The [symbol] in [scene] represents [idea]'.",
  character:
    "A character is a person (or being) in the film. When analyzing a character, focus on their decisions, relationships, and how they change. Example: 'Juno's choice reveals her values around family and responsibility'.",
  relationship:
    "A relationship is the connection between two characters — how they interact, what they mean to each other, how it changes. Name the two people and describe one moment that shows the dynamic.",
  conflict:
    "Conflict is what the character wants versus what stands in their way — internal struggle (doubts, fears) or external struggle (other characters, circumstances). Name one moment where the conflict is visible.",
  comparison:
    "Comparison means looking at how two films (or characters, or moments) are similar or different. Try: 'In [film A], [idea], but in [film B], [different idea].' Name a moment from each.",
  cinematography:
    "Cinematography is how the camera captures the image — framing, angles, movement, focus. It includes lighting (brightness, shadows), color, and composition (what's in the shot, where it's positioned).",
  visual:
    "Visual refers to anything you see on screen — colors, framing, lighting, movement, editing. When analyzing visual style, name one specific choice: 'The close-up on her face' or 'the dark blue lighting'.",
  pacing:
    "Pacing is how fast or slow the film moves — are scenes long and quiet, or short and frantic? Does the editing cut quickly or linger? It shapes how you feel while watching.",
  editing:
    "Editing is how shots are put together — quick cuts make intensity, long takes create calm or dread. It controls rhythm and how much time you spend with a moment or character.",
  framing:
    "Framing is what the camera chooses to show — is the character centered or shoved to the side? Is the shot wide (showing space) or tight (focusing on one thing)? It guides your attention.",
  symbolism:
    "Symbolism is when objects, colors, or actions represent deeper meanings. A locked door might mean isolation, rain might mean sadness or cleansing. Connect the symbol to the theme.",
  protagonist:
    "The protagonist is the main character whose story you're following and whose perspective matters most. Name them and describe one decision they make that drives the story forward.",
  antagonist:
    "The antagonist is the main force working against the protagonist — another character, a circumstance, or even the protagonist's own doubts. It doesn't have to be a villain.",
  plot:
    "Plot is what happens in the story — the events and decisions that move things forward. Don't just summarize; connect plot events to the theme: 'When [plot event], it shows that [idea]'.",
  dramatic:
    "Dramatic means emotionally intense or full of conflict. A dramatic moment is one where stakes feel high, emotions run strong, or a character makes a crucial decision.",
};

function detectConceptQuestion(answer: string): string | null {
  const n = answer.trim().toLowerCase().replace(/what's/g, "what is");
  for (const [concept, definition] of Object.entries(CONCEPT_DEFINITIONS)) {
    if (
      n.includes(`what is a ${concept}`) ||
      n.includes(`what is ${concept}`) ||
      n.includes(`what are ${concept}`) ||
      n.includes(`what are ${concept}s`) ||
      n.includes(`what does ${concept} mean`) ||
      n.includes(`can you explain ${concept}`) ||
      n.includes(`explain ${concept}`) ||
      n.includes(`tell me what ${concept} is`) ||
      n === `${concept}?` ||
      n === `define ${concept}`
    ) {
      return definition;
    }
  }
  if (n === "?" || n.includes("what does that mean") || n.includes("i don't understand the question")) {
    return "You can ask 'what is a theme', 'what is a technique', or 'what is a moment' and I'll explain it before you answer.";
  }
  return null;
}

const AFFIRMATIVE_PHRASES = [
  "yes", "yeah", "yep", "ok", "okay", "sure", "please", "yes please",
  "yes sure", "sounds good", "absolutely", "go ahead", "sure thing",
  "definitely", "of course", "that sounds good",
];
const NEGATIVE_PHRASES = [
  "no", "nope", "nah", "not now", "no thanks", "not really",
  "i'm good", "im good", "no thank you", "skip it", "never mind", "no need",
];

function isAffirmativeFollowup(answer: string): boolean {
  return AFFIRMATIVE_PHRASES.includes(answer.trim().toLowerCase());
}

function isNegativeFollowup(answer: string): boolean {
  return NEGATIVE_PHRASES.includes(answer.trim().toLowerCase());
}

function isVagueAnswer(answer: string): boolean {
  const n = answer.trim().toLowerCase().replace(/[.!?,]+$/, "");
  if (!n) return true;
  return [
    "idk", "i dont know", "i don't know", "not sure",
    "no idea", "maybe", "unsure", "dont know",
  ].some((p) => n === p);
}

function isMoveOnIntent(answer: string): boolean {
  const n = answer.trim().toLowerCase();
  return [
    "move on", "skip", "next question", "can i move on", "can we move on",
    "let's move on", "lets move on", "i want to move on", "just move on",
    "skip this", "skip it", "next", "go next", "move forward",
  ].some((p) => n === p || n.includes(p));
}

function cleanCardText(text: string): string {
  return text.replace(/\*/g, "").trim();
}

export default function QuizPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<TutorQuizResponse | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  // MC state
  const [selectedOption, setSelectedOption] = useState("");

  // Short-answer state
  const [shortAnswer, setShortAnswer] = useState("");
  const [shortAnswerThread, setShortAnswerThread] = useState<TutorTurn[]>([]);
  const [awaitingConceptFollowup, setAwaitingConceptFollowup] = useState(false);

  // Per-question state machine
  const [questionStatus, setQuestionStatus] = useState<QuestionStatus>("idle");
  const [attempts, setAttempts] = useState(0);
  const [scaffoldStepIndex, setScaffoldStepIndex] = useState(0);
  const [showFallbackMC, setShowFallbackMC] = useState(false);
  const [fallbackMCSelected, setFallbackMCSelected] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);

  // IDK / off-topic tracking
  const [consecutiveUncertain, setConsecutiveUncertain] = useState(0);
  const [showUncertainActions, setShowUncertainActions] = useState(false);
  const [consecutiveOffTopic, setConsecutiveOffTopic] = useState(0);

  // MCQ dimming after second wrong attempt
  const [dimmedOptions, setDimmedOptions] = useState<Set<string>>(new Set());

  // Hint cycling
  const [hintCycleIndex, setHintCycleIndex] = useState(0);
  // Suppresses the inline Move On button after the student picks "Hint" from the uncertain-action
  // row, until they submit another real answer. Without this, attempts >= 2 causes Move On to
  // reappear immediately, defeating the purpose of giving the hint.
  const [hintJustGiven, setHintJustGiven] = useState(false);

  // YouTube recap clip shown after memory_gap
  const [memoryClip, setMemoryClip] = useState<{ videoId: string; title: string } | null>(null);

  const [quizComplete, setQuizComplete] = useState(false);

  // Quiz persistence
  const [quizStorageKey, setQuizStorageKey] = useState<string | null>(null);
  // Prevents the activeQuestion reset effect from wiping shortAnswerThread on storage restore
  const skipThreadResetRef = useRef(false);

  useEffect(() => {
    async function loadQuiz() {
      const params = new URLSearchParams(window.location.search);
      const source = params.get("source");
      const usernameParam = params.get("username")?.trim() ?? "";

      setIsLoading(true);
      setError(null);

      try {
        // Compute key before any network work so we can restore early
        const sourceId = source === "manual" ? "manual" : usernameParam;
        const key = sourceId ? `mel_quiz_${sourceId}` : null;
        setQuizStorageKey(key);

        if (key) {
          const storedRaw = sessionStorage.getItem(key);
          if (storedRaw) {
            let restored = false;
            try {
              const parsed = JSON.parse(storedRaw) as {
                version: number;
                quizData: TutorQuizResponse;
                questionIndex: number;
                shortAnswerThread: TutorTurn[];
                attempts?: number;
                questionStatus?: QuestionStatus;
                scaffoldStepIndex?: number;
                showFallbackMC?: boolean;
                consecutiveUncertain?: number;
                consecutiveOffTopic?: number;
                hintCycleIndex?: number;
                awaitingConceptFollowup?: boolean;
                showUncertainActions?: boolean;
                hintJustGiven?: boolean;
                interpretationOverrideSent?: boolean;
                compareOverrideSent?: boolean;
                quizComplete?: boolean;
              };
              if (parsed.version === QUIZ_STORAGE_VERSION && parsed.quizData?.quiz) {
                // Signal the activeQuestion effect to skip its thread reset this once
                skipThreadResetRef.current = true;
                setQuizData(parsed.quizData);
                setQuestionIndex(parsed.questionIndex ?? 0);
                setShortAnswerThread(parsed.shortAnswerThread ?? []);
                setAttempts(parsed.attempts ?? 0);
                setQuestionStatus(parsed.questionStatus ?? "idle");
                setScaffoldStepIndex(parsed.scaffoldStepIndex ?? 0);
                setShowFallbackMC(parsed.showFallbackMC ?? false);
                setConsecutiveUncertain(parsed.consecutiveUncertain ?? 0);
                setConsecutiveOffTopic(parsed.consecutiveOffTopic ?? 0);
                setHintCycleIndex(parsed.hintCycleIndex ?? 0);
                setAwaitingConceptFollowup(parsed.awaitingConceptFollowup ?? false);
                setShowUncertainActions(parsed.showUncertainActions ?? false);
                setHintJustGiven(parsed.hintJustGiven ?? false);
                setInterpretationOverrideSent(parsed.interpretationOverrideSent ?? false);
                setCompareOverrideSent(parsed.compareOverrideSent ?? false);
                setQuizComplete(parsed.quizComplete ?? false);
                restored = true;
              }
            } catch {
              // Malformed JSON or wrong schema — discard silently
            }
            if (!restored) sessionStorage.removeItem(key);
            if (restored) {
              setIsLoading(false);
              return;
            }
          }
        }

        let films: FilmInput[];
        let quizUsername: string;
        let quizSourceUrl: string;

        if (source === "manual") {
          const stored = sessionStorage.getItem("manualFilms");
          const sessionExpiredError =
            "Your session has expired. Please go back and re-enter your films to start the quiz.";

          if (!stored) {
            setError(sessionExpiredError);
            setIsLoading(false);
            return;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(stored);
          } catch {
            setError(sessionExpiredError);
            setIsLoading(false);
            return;
          }

          if (
            !Array.isArray(parsed) ||
            parsed.length === 0 ||
            !(parsed as FilmInput[]).every((f) => typeof f.title === "string" && f.title.trim())
          ) {
            setError(sessionExpiredError);
            setIsLoading(false);
            return;
          }

          films = parsed as FilmInput[];
          quizUsername = "Manual entry";
          quizSourceUrl = "manual";
        } else {
          // Letterboxd path: scrape as before
          if (!usernameParam) {
            setError("Add a username in the URL to start the quiz.");
            setIsLoading(false);
            return;
          }
          const scrapeResponse = await fetch("/api/letterboxd/top4", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: usernameParam }),
          });

          const scrapePayload = (await scrapeResponse.json()) as Top4Response;
          if (!scrapePayload.ok) {
            setError(scrapePayload.error);
            setIsLoading(false);
            return;
          }

          films = scrapePayload.films.map((f) => ({ ...f, source: "letterboxd" as const }));
          quizUsername = scrapePayload.username;
          quizSourceUrl = scrapePayload.source_url;
        }

        const tutorResponse = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "quiz",
            username: quizUsername,
            source_url: quizSourceUrl,
            films,
          }),
        });

        const tutorPayload = (await tutorResponse.json()) as TutorResponse;
        if (tutorPayload.ok && tutorPayload.mode === "quiz") {
          setQuizData(tutorPayload);
          setQuestionIndex(0);
          setIsLoading(false);
          return;
        }

        setError("Unable to load the quiz.");
      } catch {
        setError("The quiz could not be loaded right now. Try again in a moment.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadQuiz();
  }, []);

  const activeQuestion = useMemo((): QuizQuestion | null => {
    if (!quizData) return null;
    return quizData.quiz.questions[questionIndex] ?? null;
  }, [quizData, questionIndex]);

  // Override deduplication flags — server signals these when it applies an override;
  // client sends them back so the route doesn't repeat the same nudge next turn.
  const [interpretationOverrideSent, setInterpretationOverrideSent] = useState(false);
  const [compareOverrideSent, setCompareOverrideSent] = useState(false);

  // Reset all per-question state when the active question changes
  useEffect(() => {
    // Skip the reset once after a storage restore — the persisted thread is already in state
    if (skipThreadResetRef.current) {
      skipThreadResetRef.current = false;
      return;
    }
    setSelectedOption("");
    setShortAnswer("");
    setQuestionStatus("idle");
    setAttempts(0);
    setScaffoldStepIndex(0);
    setShowFallbackMC(false);
    setFallbackMCSelected("");
    setIsEvaluating(false);
    setConsecutiveUncertain(0);
    setShowUncertainActions(false);
    setConsecutiveOffTopic(0);
    setDimmedOptions(new Set());
    setHintCycleIndex(0);
    setHintJustGiven(false);
    setAwaitingConceptFollowup(false);
    setInterpretationOverrideSent(false);
    setCompareOverrideSent(false);
    setMemoryClip(null);

    if (activeQuestion?.questionType === "short_answer") {
      setShortAnswerThread([{ role: "tutor", text: activeQuestion.prompt }]);
    } else {
      setShortAnswerThread([]);
    }
  }, [activeQuestion]);

  // Persist quiz state to sessionStorage so a refresh restores the session
  useEffect(() => {
    if (!quizData || !quizStorageKey) return;
    try {
      sessionStorage.setItem(
        quizStorageKey,
        JSON.stringify({
          version: QUIZ_STORAGE_VERSION,
          quizData,
          questionIndex,
          shortAnswerThread,
          attempts,
          questionStatus,
          scaffoldStepIndex,
          showFallbackMC,
          consecutiveUncertain,
          consecutiveOffTopic,
          hintCycleIndex,
          awaitingConceptFollowup,
          showUncertainActions,
          hintJustGiven,
          interpretationOverrideSent,
          compareOverrideSent,
          quizComplete,
        })
      );
    } catch {
      // Quota exceeded or private browsing — skip silently
    }
  }, [
    quizData, questionIndex, shortAnswerThread, quizStorageKey,
    attempts, questionStatus, scaffoldStepIndex, showFallbackMC,
    consecutiveUncertain, consecutiveOffTopic, hintCycleIndex,
    awaitingConceptFollowup, showUncertainActions, hintJustGiven,
    interpretationOverrideSent, compareOverrideSent, quizComplete,
  ]);

  async function handleSubmitAnswer() {
    if (!activeQuestion) return;

    // ── MCQ path ──────────────────────────────────────────────────────────────
    if (activeQuestion.questionType === "multiple_choice") {
      if (!selectedOption) return;
      if (selectedOption === activeQuestion.correctAnswer) {
        setQuestionStatus("correct");
        return;
      }
      const newAttempts = attempts + 1;
      setAttempts(prev => prev + 1);
      if (newAttempts >= 3) {
        setQuestionStatus("exhausted");
      } else {
        setQuestionStatus("confused");
        if (newAttempts === 2) {
          // Dim 1-2 wrong options (prefer later positions in the list)
          const wrongOpts = activeQuestion.options.filter(
            (o) => o !== activeQuestion.correctAnswer
          );
          const toDim = new Set(wrongOpts.slice(-Math.min(2, wrongOpts.length - 1)));
          setDimmedOptions(toDim);
        }
      }
      return;
    }

    // ── Short answer path ─────────────────────────────────────────────────────
    if (showFallbackMC) return;

    const trimmed = shortAnswer.trim();
    if (!trimmed) {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "tutor", text: "Give me one short sentence and we can build from there." },
      ]);
      return;
    }

    // Handle concept clarification locally so follow-ups like "yes" are not misread as answers.
    const conceptDefinition = detectConceptQuestion(trimmed);
    if (conceptDefinition) {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "user", text: trimmed },
        {
          role: "tutor",
          text: `${conceptDefinition} If you want, reply 'yes' and I'll give a quick example tied to this question.`,
        },
      ]);
      setShortAnswer("");
      setAwaitingConceptFollowup(true);
      return;
    }

    if (awaitingConceptFollowup && isAffirmativeFollowup(trimmed)) {
      const conceptLead = activeQuestion.focus.toLowerCase().includes("compare")
        ? "Try: 'In [film A], [moment] shows __, while in [film B], [moment] shows __. This suggests __.'"
        : "Try: 'When [specific moment], it suggests [idea about the theme/character].'";
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "user", text: trimmed },
        { role: "tutor", text: `${conceptLead} Now try your own one-sentence version.` },
      ]);
      setShortAnswer("");
      setAwaitingConceptFollowup(false);
      return;
    }

    if (awaitingConceptFollowup && isNegativeFollowup(trimmed)) {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "user", text: trimmed },
        { role: "tutor", text: "Great — go ahead and answer the original question in one short sentence." },
      ]);
      setShortAnswer("");
      setAwaitingConceptFollowup(false);
      return;
    }

    // Intercept move-on intent — surface the action panel, never evaluate
    if (isMoveOnIntent(trimmed)) {
      setShortAnswerThread((cur) => [...cur, { role: "user", text: trimmed }]);
      setShortAnswer("");
      setShowUncertainActions(true);
      return;
    }

    // Intercept vague/idk before LLM — treat as uncertainty, not failure
    if (isVagueAnswer(trimmed)) {
      setShortAnswerThread((cur) => [...cur, { role: "user", text: trimmed }]);
      setShortAnswer("");
      const newConsecutive = consecutiveUncertain + 1;
      setConsecutiveUncertain(newConsecutive);
      if (newConsecutive >= 2 || consecutiveOffTopic >= 1) {
        setShowUncertainActions(true);
      } else {
        setShortAnswerThread((cur) => [
          ...cur,
          { role: "tutor", text: "What part feels unclear — the film, the concept, or the question?" },
        ]);
      }
      return; // No attempt counted
    }

    // Real answer — reset consecutive uncertain and hint suppression
    setConsecutiveUncertain(0);
    setHintJustGiven(false);
    setAwaitingConceptFollowup(false);

    setShortAnswerThread((cur) => [...cur, { role: "user", text: trimmed }]);
    setShortAnswer("");
    setIsEvaluating(true);

    const filmInFocus =
      (activeQuestion as { filmInFocus?: string }).filmInFocus ||
      quizData?.quiz.transferConcept.filmA ||
      quizData?.films[0]?.title ||
      "";

    let verdict: { ok: true; verdict: EvaluateVerdict; feedback: string; nextHint?: string };
    try {
      const payload: EvaluateRequest = {
        question: activeQuestion as import("@/lib/film-tutor/types").ShortAnswerQuestion,
        studentAnswer: trimmed,
        priorTurns: shortAnswerThread,
        films: (quizData?.films ?? []) as FilmInput[],
        filmInFocus,
        interpretationOverrideSent,
        compareOverrideSent,
      };
      const res = await fetch("/api/tutor/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as EvaluateResponse;
      if (!data.ok) throw new Error(data.error);
      if (data.interpretationOverrideSent) setInterpretationOverrideSent(true);
      if (data.compareOverrideSent) setCompareOverrideSent(true);
      verdict = data;
    } catch {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "tutor", text: activeQuestion.partialFeedback },
      ]);
      setQuestionStatus("partial");
      setIsEvaluating(false);
      return;
    } finally {
      setIsEvaluating(false);
    }

    // concept_question and memory_gap: no attempt counted
    if (verdict.verdict === "concept_question" || verdict.verdict === "memory_gap") {
      if (verdict.verdict === "memory_gap") {
        setShortAnswerThread((cur) => [
          ...cur,
          { role: "tutor", text: "No problem — here are some options to help you move forward." },
        ]);
        setShowUncertainActions(true);
        void fetch(`/api/film-clip?title=${encodeURIComponent(filmInFocus)}`)
          .then((r) => r.json())
          .then((d: { ok: boolean; videoId?: string; title?: string }) => {
            if (d.ok && d.videoId && d.title) setMemoryClip({ videoId: d.videoId, title: d.title });
          })
          .catch(() => undefined);
      } else {
        setShortAnswerThread((cur) => [...cur, { role: "tutor", text: verdict.feedback }]);
        setAwaitingConceptFollowup(true);
      }
      return;
    }

    if (verdict.verdict === "off_base") {
      // off_base counts as a real attempt so the Move On button unlocks after 2 tries
      setAttempts(prev => prev + 1);
      const newOffTopic = consecutiveOffTopic + 1;
      setConsecutiveOffTopic(newOffTopic);
      if (newOffTopic >= 2 || consecutiveUncertain >= 1) {
        setShortAnswerThread((cur) => [
          ...cur,
          { role: "tutor", text: "Let me offer a different approach." },
        ]);
        setShowUncertainActions(true);
      } else {
        setShortAnswerThread((cur) => [...cur, { role: "tutor", text: verdict.feedback }]);
      }
      return;
    }

    // Reset off-topic counter on correct/partial
    setConsecutiveOffTopic(0);

    // correct and partial both count as a real attempt
    setAttempts(prev => prev + 1);

    if (verdict.verdict === "correct") {
      setShortAnswerThread((cur) => [...cur, { role: "tutor", text: verdict.feedback }]);
      setQuestionStatus("correct");
      return;
    }

    // partial — never auto-reveal; Move on button appears at attempts >= 2
    const tutorText = verdict.nextHint
      ? `${verdict.feedback} ${verdict.nextHint}`
      : verdict.feedback;
    setShortAnswerThread((cur) => [...cur, { role: "tutor", text: tutorText }]);
    setQuestionStatus("partial");
  }

  function handleUncertainAction(action: "hint" | "mc" | "moveon") {
    if (!activeQuestion || activeQuestion.questionType !== "short_answer") return;
    setShowUncertainActions(false);
    setConsecutiveUncertain(0);
    setConsecutiveOffTopic(0);

    if (action === "hint") {
      setHintJustGiven(true);
      setHintCycleIndex(0);
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "tutor", text: `Here is a hint: ${activeQuestion.hint}` },
      ]);
    } else if (action === "mc") {
      if (activeQuestion.fallbackMultipleChoice) {
        setShowFallbackMC(true);
      }
    } else {
      setQuestionStatus("revealed");
    }
  }

  function handleFallbackMCSubmit() {
    if (!activeQuestion || activeQuestion.questionType !== "short_answer") return;
    const mc = activeQuestion.fallbackMultipleChoice;
    if (!mc || !fallbackMCSelected) return;

    // Fallback MC is a genuine attempt — count it once regardless of whether the answer is correct
    setAttempts((a) => a + 1);

    if (fallbackMCSelected === mc.correctAnswer) {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "user", text: fallbackMCSelected },
        { role: "tutor", text: `${mc.explanation} ${activeQuestion.correctFeedback}` },
      ]);
      setQuestionStatus("correct");
    } else {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "user", text: fallbackMCSelected },
        {
          role: "tutor",
          text: `The answer is: ${mc.correctAnswer}. ${mc.explanation} Let's keep going.`,
        },
      ]);
      setQuestionStatus("revealed");
    }
    setShowFallbackMC(false);
    setFallbackMCSelected("");
  }

  function handleNextQuestion() {
    if (!quizData) return;
    if (questionIndex >= quizData.quiz.questions.length - 1) {
      setQuizComplete(true);
      return;
    }
    setQuestionIndex((i) => i + 1);
  }

  function handleStartOver() {
    if (quizStorageKey) sessionStorage.removeItem(quizStorageKey);
    window.location.reload();
  }

  const canAdvance =
    questionStatus === "correct" || questionStatus === "revealed" || questionStatus === "exhausted";

  const isLastQuestion =
    quizData != null && questionIndex >= quizData.quiz.questions.length - 1;

  // Scaffold step shown when in confused mode
  const currentScaffoldStep =
    activeQuestion?.questionType === "short_answer" && questionStatus === "confused" && !showFallbackMC
      ? activeQuestion.scaffoldSteps[scaffoldStepIndex - 1]
      : undefined;

  // Hint cycling: primary hint → scaffold step hint → concept definition
  const availableHints = useMemo(() => {
    if (!activeQuestion) return [] as string[];
    const hints: string[] = [activeQuestion.hint];
    if (activeQuestion.questionType === "short_answer") {
      for (const step of activeQuestion.scaffoldSteps) {
        if (step.hint && step.hint !== activeQuestion.hint && !hints.includes(step.hint)) {
          hints.push(step.hint);
        }
      }
    }
    return hints;
  }, [activeQuestion]);

  const hintText = availableHints[hintCycleIndex % Math.max(1, availableHints.length)] ?? "";

  return (
    <main className="min-h-screen px-4 py-6 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(49,57,70,0.96),rgba(31,37,46,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-10">
            <aside className="space-y-5 rounded-[1.8rem] border border-white/10 bg-[#20252d] p-5 shadow-inner sm:p-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tracking-[0.28em] uppercase text-[var(--text-muted)]">
                  <span>Mise-en-Lens</span>
                  <span className="rounded-full border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/12 px-3 py-1 text-[var(--accent-green)]">
                    Quiz flow
                  </span>
                </div>
                <h1 className="font-serif text-4xl leading-tight text-white">Practice with your Top 4</h1>
                <p className="text-sm leading-7 text-[var(--text-soft)]">
                  One question at a time, lighter prompts, and quick feedback that keeps the focus
                  on learning instead of long-form writing.
                </p>
              </div>

              {quizData ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-orange)]">
                      Profile
                    </p>
                    <h2 className="font-serif text-2xl text-white">{quizData.username}</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {quizData.films.map((film, index) => (
                      <div
                        key={`${film.title}-${index}`}
                        className="overflow-hidden rounded-[1.15rem] border border-white/10 bg-[var(--panel)]"
                      >
                        <div className="aspect-[2/3] bg-black/20">
                          {film.poster_url ? (
                            <Image
                              src={film.poster_url}
                              alt={`Poster for ${film.title}`}
                              width={400}
                              height={600}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--text-muted)]">
                              Poster unavailable
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[var(--accent-blue)]">
                            Favorite {index + 1}
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-5 text-white">
                            {film.title}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={quizData.username === "Manual entry" ? "/" : `/?prefill=${encodeURIComponent(quizData.username)}`}
                      className="inline-flex items-center rounded-[1rem] border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-[var(--text-soft)] transition hover:bg-white/10"
                    >
                      Back to lesson
                    </Link>
                    <button
                      type="button"
                      onClick={handleStartOver}
                      className="rounded-[1rem] border border-white/8 bg-white/4 px-4 py-3 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white/8"
                    >
                      Start over
                    </button>
                  </div>
                </div>
              ) : null}
            </aside>

            <div className="space-y-6 rounded-[1.8rem] border border-white/10 bg-[linear-gradient(160deg,rgba(36,42,50,0.98),rgba(28,34,42,0.96))] p-6 sm:p-8">
              {isLoading ? (
                <div className="space-y-4">
                  <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-blue)]">
                    Loading quiz
                  </p>
                  <h2 className="font-serif text-3xl text-white">Building your guided practice</h2>
                  <p className="max-w-2xl text-sm leading-7 text-[var(--text-soft)]">
                    Pulling the profile and generating a lighter set of quiz questions.
                  </p>
                </div>
              ) : error ? (
                <div className="rounded-[1.3rem] border border-[var(--accent-orange)]/25 bg-[var(--accent-orange)]/10 px-4 py-4 text-sm leading-6 text-[#ffd9b8]">
                  <p>{error}</p>
                  <div className="mt-4">
                    <Link
                      href="/"
                      className="inline-flex items-center rounded-[1rem] bg-[var(--accent-orange)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105"
                    >
                      Return home
                    </Link>
                  </div>
                </div>
              ) : quizComplete && quizData ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-green)]">
                      Quiz complete
                    </p>
                    <h2 className="mt-2 font-serif text-3xl text-white">Nice work!</h2>
                  </div>
                  <p className="text-sm leading-7 text-[var(--text-soft)]">
                    You worked through all {quizData.quiz.questions.length} questions. Keep
                    exploring — film literacy builds with every viewing.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={
                        quizData.username === "Manual entry"
                          ? "/"
                          : `/?prefill=${encodeURIComponent(quizData.username)}`
                      }
                      className="inline-flex items-center rounded-[1rem] bg-[var(--accent-green)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105"
                    >
                      Back to lesson
                    </Link>
                    <button
                      type="button"
                      onClick={handleStartOver}
                      className="rounded-[1rem] border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white/10"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : quizData && activeQuestion ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-blue)]">
                        {quizData.quiz.title}
                      </p>
                      <h2 className="mt-2 font-serif text-3xl text-white">Question {questionIndex + 1}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {quizData.generatedBy === "fallback" ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
                          Offline mode
                        </span>
                      ) : null}
                      <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-[var(--text-soft)]">
                        Question {questionIndex + 1} of {quizData.quiz.questions.length} &middot; {SECTION_BY_INDEX[questionIndex] ?? ""}
                      </div>
                    </div>
                  </div>

                  {/* Transfer teach block — shown before Q7 (index 6) */}
                  {questionIndex === 6 ? (
                    <div className="rounded-[1.2rem] border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 px-4 py-3 text-sm leading-6 text-[#d4ebfa]">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                        Learn this first
                      </p>
                      <p className="mt-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--accent-blue)]/60">
                        {quizData.quiz.transferConcept.concept} &mdash; {quizData.quiz.transferConcept.filmA}
                      </p>
                      <p className="mt-2">
                        {cleanCardText(quizData.quiz.transferConcept.teachStatement)}
                      </p>
                    </div>
                  ) : null}

                  {quizData.warning ? (
                    <div className="rounded-[1.2rem] border border-[var(--accent-orange)]/25 bg-[var(--accent-orange)]/10 px-4 py-3 text-sm leading-6 text-[#ffd9b8]">
                      {quizData.warning}
                    </div>
                  ) : null}

                  {/* Section header */}
                  <p className="text-xs font-semibold tracking-[0.28em] uppercase text-[var(--accent-blue)]">
                    {SECTION_BY_INDEX[questionIndex] ?? ""}
                  </p>

                  {/* Question prompt — dimmed when scaffold is active */}
                  <div
                    className={`rounded-[1.35rem] border border-white/10 bg-white/5 p-5 transition ${
                      questionStatus === "confused" && activeQuestion.questionType === "short_answer"
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-green)]">
                        Focus: {activeQuestion.focus}
                      </p>
                      {activeQuestion.focus === "Reflection" ? (
                        <span className="rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--accent-blue)]/80">
                          Reflection — no wrong answers
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xl leading-8 text-white">{cleanCardText(activeQuestion.prompt)}</p>
                  </div>

                  {/* Scaffold prompt — shown when in scaffold mode (no fallback MC yet) */}
                  {questionStatus === "confused" &&
                    activeQuestion.questionType === "short_answer" &&
                    !showFallbackMC &&
                    currentScaffoldStep ? (
                    <div className="rounded-[1.2rem] border border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/8 px-4 py-3 text-sm leading-6 text-[#ffd9b8]">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-orange)]">
                        Step {scaffoldStepIndex} of {activeQuestion.scaffoldSteps.length}
                      </p>
                      <p className="mt-2">{cleanCardText(currentScaffoldStep.prompt)}</p>
                    </div>
                  ) : null}

                  {/* Revealed panel — for SA questions show the hint, not a single "correct" answer */}
                  {questionStatus === "revealed" ? (
                    <div className="rounded-[1.2rem] border border-white/20 bg-white/8 px-4 py-4 text-sm leading-6 text-white">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                        {activeQuestion.questionType === "short_answer" ? "Things to look for" : "Answer"}
                      </p>
                      <p className="mt-2">
                        {activeQuestion.questionType === "short_answer"
                          ? cleanCardText(activeQuestion.hint)
                          : cleanCardText(activeQuestion.correctAnswer)}
                      </p>
                    </div>
                  ) : null}

                  {activeQuestion.questionType === "multiple_choice" ? (
                    <div className="grid gap-3">
                      {activeQuestion.options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          disabled={questionStatus !== "idle" && questionStatus !== "confused"}
                          onClick={() => setSelectedOption(option)}
                          className={`rounded-[1.1rem] border px-4 py-4 text-left text-sm font-medium transition ${
                            dimmedOptions.has(option)
                              ? "opacity-35 border-white/10 bg-white/5 text-[var(--text-soft)]"
                              : questionStatus === "correct" && option === activeQuestion.correctAnswer
                                ? "border-[var(--accent-green)] bg-[var(--accent-green)]/12 text-white"
                                : selectedOption === option
                                  ? "border-[var(--accent-green)] bg-[var(--accent-green)]/12 text-white"
                                  : "border-white/10 bg-white/5 text-[var(--text-soft)] hover:bg-white/8"
                          }`}
                        >
                          {cleanCardText(option)}
                        </button>
                      ))}
                      {questionStatus === "confused" ? (
                        <p className="text-center text-xs text-[var(--text-muted)]">
                          {attempts === 2
                            ? "One more try. A hint has been added below."
                            : "Give it another try."}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Conversation thread */}
                      <div className="space-y-2 rounded-[1.1rem] border border-white/10 bg-white/5 p-3">
                        {shortAnswerThread.map((turn, index) => (
                          <div
                            key={`${turn.role}-${index}`}
                            className={`max-w-[92%] rounded-[0.9rem] px-3 py-2 text-sm leading-6 ${
                              turn.role === "tutor"
                                ? "border border-white/10 bg-black/20 text-[var(--text-soft)]"
                                : "ml-auto border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/12 text-white"
                            }`}
                          >
                            {cleanCardText(turn.text)}
                          </div>
                        ))}
                      </div>

                      {/* Fallback MC — replaces textarea when triggered */}
                      {showFallbackMC && activeQuestion.fallbackMultipleChoice ? (
                        <div className="space-y-3 rounded-[1.1rem] border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                            Pick one
                          </p>
                          <p className="text-sm leading-6 text-white">
                            {cleanCardText(activeQuestion.fallbackMultipleChoice.prompt)}
                          </p>
                          <div className="grid gap-2">
                            {activeQuestion.fallbackMultipleChoice.options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setFallbackMCSelected(opt)}
                                className={`rounded-[1rem] border px-4 py-3 text-left text-sm font-medium transition ${
                                  fallbackMCSelected === opt
                                    ? "border-[var(--accent-green)] bg-[var(--accent-green)]/12 text-white"
                                    : "border-white/10 bg-white/5 text-[var(--text-soft)] hover:bg-white/8"
                                }`}
                              >
                                {cleanCardText(opt)}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleFallbackMCSubmit}
                            disabled={!fallbackMCSelected}
                            className="rounded-[1rem] bg-[var(--accent-green)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Submit
                          </button>
                        </div>
                      ) : showUncertainActions && !canAdvance ? (
                        <div className="rounded-[1.1rem] border border-white/10 bg-white/5 p-4 space-y-3">
                          {memoryClip ? (
                            <a
                              href={`https://www.youtube.com/watch?v=${memoryClip.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 overflow-hidden rounded-[0.75rem] border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--text-soft)] transition hover:bg-white/10"
                            >
                              <span>▶</span>
                              <span className="min-w-0 flex-1 truncate">Watch a recap: {memoryClip.title}</span>
                            </a>
                          ) : null}
                          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                            Pick one to continue
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleUncertainAction("hint")}
                              className="rounded-[1rem] border border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/8 px-4 py-2.5 text-sm font-semibold text-[#ffd9b8] transition hover:bg-[var(--accent-orange)]/15"
                            >
                              Hint
                            </button>
                            {activeQuestion.fallbackMultipleChoice ? (
                              <button
                                type="button"
                                onClick={() => handleUncertainAction("mc")}
                                className="rounded-[1rem] border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/8 px-4 py-2.5 text-sm font-semibold text-[#d4ebfa] transition hover:bg-[var(--accent-blue)]/15"
                              >
                                Multiple choice version
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleUncertainAction("moveon")}
                              className="rounded-[1rem] border border-white/15 bg-white/6 px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white/10"
                            >
                              Move on
                            </button>
                          </div>
                        </div>
                      ) : questionStatus !== "correct" && questionStatus !== "revealed" && questionStatus !== "exhausted" ? (
                        <>
                          <textarea
                            value={shortAnswer}
                            onChange={(e) => setShortAnswer(e.target.value)}
                            placeholder={activeQuestion.placeholder}
                            disabled={isEvaluating}
                            className="min-h-28 w-full rounded-[1.1rem] border border-white/12 bg-white/6 px-4 py-4 text-base text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-green)] focus:bg-white/8 disabled:opacity-50"
                          />
                          <p className="text-xs text-[var(--text-muted)]">
                            Keep it to about {activeQuestion.maxWords < 8 ? 15 : activeQuestion.maxWords} words or fewer.
                          </p>
                        </>
                      ) : null}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {!showFallbackMC ? (
                      <button
                        type="button"
                        onClick={() => { void handleSubmitAnswer(); }}
                        disabled={
                          canAdvance ||
                          isEvaluating ||
                          (activeQuestion.questionType === "multiple_choice" && !selectedOption)
                        }
                        className="rounded-[1rem] bg-[var(--accent-green)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isEvaluating ? "Evaluating…" : "Submit answer"}
                      </button>
                    ) : null}
                    {isEvaluating ? (
                      <span className="self-center animate-pulse text-xs text-[var(--text-muted)]">
                        Checking your answer…
                      </span>
                    ) : null}
                    {/* Move on option — shown after 2+ attempts on short-answer questions */}
                    {activeQuestion.questionType === "short_answer" &&
                      !canAdvance &&
                      !showFallbackMC &&
                      !showUncertainActions &&
                      !hintJustGiven &&
                      attempts >= 2 ? (
                      <button
                        type="button"
                        onClick={() => setQuestionStatus("revealed")}
                        className="rounded-[1rem] border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white/10"
                      >
                        Move on
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      disabled={!canAdvance}
                      className="rounded-[1rem] border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-[var(--text-soft)] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLastQuestion ? "Finish quiz" : "Next question"}
                    </button>
                  </div>

                  {hintText ? (
                    <div
                      className={`rounded-[1rem] bg-black/15 p-4 transition ${
                        questionStatus === "revealed" ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-orange)]">
                          Hint
                        </p>
                        {availableHints.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setHintCycleIndex((i) => i + 1)}
                            className="text-xs text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-soft)] hover:underline"
                          >
                            Show a different hint
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                        {cleanCardText(hintText)}
                      </p>
                    </div>
                  ) : null}

                  {/* MC feedback panel */}
                  {activeQuestion.questionType === "multiple_choice" && questionStatus !== "idle" ? (
                    <div
                      className={`rounded-[1.2rem] border px-4 py-4 text-sm leading-7 ${
                        questionStatus === "correct"
                          ? "border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[#d7f8d8]"
                          : questionStatus === "exhausted"
                            ? "border-white/10 bg-white/5 text-[var(--text-soft)]"
                            : "border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/10 text-[#ffd9b8]"
                      }`}
                    >
                      {questionStatus === "correct"
                        ? cleanCardText(activeQuestion.correctFeedback)
                        : questionStatus === "exhausted"
                          ? "Let's keep going."
                          : attempts === 1
                            ? "Not quite — try again."
                            : cleanCardText(activeQuestion.hint)}
                    </div>
                  ) : null}

                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
