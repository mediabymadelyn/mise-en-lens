# Prompt Changelog

Documents every version of the system prompt with what changed and why.
Companion to system_prompt_v0.txt through system_prompt_v4.txt.

---

## v0 — Baseline

**Date:** Early April 2026
**Files:** system_prompt_v0.txt

### What it did
Minimal prompt. Instructed the model to identify patterns in the user's Top 4, explain one film concept in beginner-friendly language, connect the concept to at least one film, and recommend a film. In quiz mode, asked the model to ask a question, follow up, and evaluate the answer.

### What went wrong
- No structural requirements so output format was inconsistent
- No feedback tone guidelines so the model gave answers directly without scaffolding
- Pedagogical response scores were consistently 0 or 1
- Quiz had only 3 questions and users could skip through without answering correctly
- idk responses returned vague hints with no simplification
- Correct answers registered as only "close" due to rigid keyword matching

---

## v1 — Structure and Feedback Rules

**Date:** Early April 2026
**Files:** system_prompt_v1.txt

### What changed
- Added required output structure: summary, artistic elements, societal context, recommendation
- Added explicit instruction to respond to partial answers with a follow-up question rather than a correction
- Added instruction to avoid revealing the correct answer on the first wrong attempt

### What improved
- Accuracy and clarity scores improved across most scenarios
- Pedagogical response improved on partial answer scenarios

### What still did not work
- idk handling remained weak; model still responded with generic encouragement or repeated the question
- The phrase "why the film cares about it" appeared in multiple generated questions and was flagged as unnatural

---

## v2 — Wikipedia Grounding and Schema Enforcement

**Date:** Mid April 2026
**Files:** system_prompt_v2.txt

### What changed
- Added Wikipedia reference block to the prompt (plot synopsis and themes fetched at runtime per film)
- Introduced JSON schema enforcement via OpenAI structured outputs parameter
- Replaced open-ended quiz format with typed question schema: multiple_choice and short_answer
- Added required fields: acceptableAnswers, acceptableKeywords, scaffoldSteps, fallbackMultipleChoice

### What improved
- Accuracy scores improved sharply
- Hallucinations dropped noticeably because the model had factual grounding
- Output format became consistent

### What still did not work
- idk handling: model moved to a scaffold step but chose steps that were not meaningfully simpler than the original question

---

## v3 — Scaffold Step Rules and Forbidden Phrases

**Date:** Late April 2026
**Files:** system_prompt_v3.txt

### What changed
- Scaffold step rules rewritten with explicit behavioral constraints
- Step one required to ask for only one small concrete thing
- Forbidden phrases listed directly in the prompt: "Think about the film's emotional journey", "Consider the story", "why the film cares about it"
- correctFeedback must name exactly what was right
- partialFeedback must name the specific part that was right before asking for more
- Hints must name at least one concrete anchor
- idk explicitly required to trigger a clarifying question rather than advancement

### What improved
- Pedagogical response scores increased
- Feedback became more specific

### What still did not work
- Model still expected a very specific answer when multiple valid interpretations existed
- The Ponyo boat scene was marked incorrect even when students gave analytically valid responses
- Multiple choice revealed the answer on first wrong attempt

---

## v4 — Multiple Valid Interpretations and Compare/Contrast

**Date:** Late April 2026
**Files:** system_prompt_v4.txt

### What changed
- Added explicit instruction that multiple valid interpretations are acceptable
- System instructed not to treat acceptableAnswers as the only correct responses
- Question-writing rule added: if the question asks about a theme, it must also require a specific scene or moment (one-word answers score as partial, not correct)
- MCQ behavior corrected: answer no longer revealed on first wrong attempt
- Compare and contrast section added as a new question type
- Quiz expanded to 9 questions with section arc: Warm-Up, Interpretation, Compare, Transfer, Reflection

### What improved
- Valid answers phrased differently than expected keywords were more often accepted
- Quiz progression felt more like a cognitive arc
- Cross-film synthesis questions added genuine transfer component

### Known remaining limitations
- Stateless evaluation architecture still causes some valid answers to be rejected when they do not contain expected keywords
- Wikipedia coverage gaps mean obscure and international films receive weaker grounding

---

## v4 patch — Evaluation fixes, quiz structure, and UX routing

**Date:** May 6 2026

### Evaluation prompt changes (evaluate/route.ts system prompt)
- `off_base` definition narrowed: a single word that names a relevant theme or concept (e.g. "family" for a family dynamics question) is now explicitly `partial`, not `off_base`
- Rule 7 (compare rubric) updated: scene/moment evidence is only required for compare questions if the prompt explicitly asks for one — character-level or dynamic descriptions are sufficient otherwise. Resolves false `partial` verdicts on valid compare answers
- Rule 9 (feedback tone) updated: removed instruction to say "That one's a bit off-track" for `off_base` verdicts. Model now instructed to acknowledge what was attempted and name what is missing, and to acknowledge what the student got right when the answer is in the right territory

### Heuristic fallback changes (heuristic-eval.ts)
- Keyword and acceptable-answer detection now runs before the word-count short-circuit. A single-word answer matching `acceptableKeywords` or `acceptableAnswers` always routes to `partial` — never `off_base`
- Test added: `"family"` (one word, in `acceptableAnswers`) now correctly returns `partial`

### Quiz structure changes (fallback.ts, openai.ts)
- Q4 moved from `filmB` to `filmC` — interpretation section now covers two different films instead of asking the same move twice on `filmB`
- Q6 changed from "filmA vs filmC on visual style" to "filmC vs filmD on the same concept as Q5" — compare section now covers all four films and uses a consistent lens across both questions
- OpenAI quiz prompt updated to match: Section 2 requires Q3 and Q4 to focus on different films; Section 3 requires Q5 and Q6 to use the same concept lens with Films 1+2 and Films 3+4 respectively

### UX routing fixes (quiz/page.tsx)
- Fixed cross-contamination between `consecutiveOffTopic` and `consecutiveUncertain` counters — each counter now triggers the uncertain actions panel only when it reaches 2 on its own, preventing a single `"idk"` after a partial verdict from escalating prematurely
- Added `awaitingClarification` state: when the tutor asks "What part feels unclear — the film, the concept, or the question?", the student's next response is now intercepted and routed to a targeted reply rather than sent to the evaluator as a quiz answer
  - "film" → shows the question's hint (scene/character-specific)
  - "concept" → plain-language explanation of the cognitive move being asked (compare or interpret)
  - "question" → plain restatement of what the question is asking
- Fixed stale fetch race condition on memory-gap recap clips: the film title is now captured at fetch time and compared to the active question when the fetch resolves — a clip fetched for a previous question is discarded if the question has changed
- Fixed YouTube recap returning wrong film: API now validates that the returned video title contains the queried film name before returning it to the client