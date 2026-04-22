I'm refactoring my film tutor quiz (Mise-en-Lens). This is a scoped, multi-phase refactor — NOT a rewrite. Work in the phases below in order. After each phase, stop and summarize what you changed before starting the next.

=== GROUND RULES ===
- Keep the existing visual language, palette, and layout. Do not redesign.
- Preserve the Top-4 flow, lesson page, Letterboxd scraping, and manual-entry path.
- Stay on the current branch. No merges, no destructive git.
- Favor targeted edits over new files. Only create new files when unavoidable.
- If something in this spec contradicts existing code, flag it and ask before guessing.

=== CONTEXT FILES ===
Before writing anything, read these to understand the current shape:
- lib/film-tutor/types.ts (or wherever QuizQuestion, ShortAnswerQuestion, TransferSequence live)
- lib/film-tutor/openai.ts (quizSchema, buildQuizPrompt)
- lib/film-tutor/fallback.ts (fallback quiz builder)
- app/quiz/page.tsx (quiz UI + state machine)
- the lesson page and the film-entry / manual-entry page

Report back what you found before editing.

=======================================================================
PHASE 1 — Small UI fixes on entry + lesson pages (do this first, it's quick)
=======================================================================

Two specific fixes, nothing else on those pages:

1. Add a visible "scroll down" affordance (a subtle chevron or arrow) below the blurb on the lesson page and below the main intro area — wherever the user needs to scroll to reach the quiz CTA or continue reading. Make it match the existing palette (use the accent-green or accent-blue CSS variable already in the project). It should gently pulse or be subtly animated, not flashy.

2. On the film-entry page, the "Enter films manually" option is too faint. Increase its visual weight so it reads as a real option, not a fallback. Bump contrast, give it equal visual weight to the Letterboxd input path. Do not restructure the page.

Stop. Summarize. Then move on.

=======================================================================
PHASE 2 — Restructure the quiz into 9 questions across 5 sections
=======================================================================

Current arc (8Q): Q1-Q2 recognition → Q3-Q5 interpretation → Q6 verify → Q7 apply → Q8 transfer.
New arc (9Q), grouped by section:

SECTION 1 — Warm-Up (Q1, Q2) — multiple_choice
- Analytical, not trivia. 4 plausible options, one strongest.
- Tests meaning, symbolism, technique, relationships, or tone.
- NO: release dates, actor names, plot recall, joke distractors.
- Example stems: "What does ___ most likely symbolize in ___?", "How does the director use cinematography in ___ to reinforce the story's themes?", "What does the ending of ___ most strongly suggest?"
- Distractors must be plausible and close. Never obviously wrong.

SECTION 2 — Interpretation (Q3, Q4) — short_answer
- Require evidence. Multiple defensible answers allowed.
- Must NOT duplicate the topic of Q1 or Q2.
- Specific, not vague. NOT yes/no, NOT "did you like it", NOT "what happened".
- Example stems: "What do you think ___ is saying about ___? Name one specific moment.", "Why do you think ___ makes this decision, and what does it reveal about them?", "How does the use of [lighting / music / framing] shape your understanding of the story?"
- maxWords: 18.

SECTION 3 — Compare/Contrast (Q5, Q6) — short_answer — NEW SECTION TYPE
- The system picks TWO of the user's Top-4 films that share an identifiable concept (theme, technique, tone, or character arc). The student does not pick the pair.
- The concept being compared must be stated in the prompt so the student doesn't have to invent the axis of comparison.
- Example stems: "How does [Film A] portray ambition differently than [Film B]?", "Which film communicates loneliness more through visuals: [Film A] or [Film B]? Name one moment.", "Compare the conflict in [Film A] to [Film B]. What changes?"
- maxWords: 20.
- These need their own focus label, e.g. focus: "Compare" — add it to whatever enum/union already tracks focus.

SECTION 4 — Transfer / Application (Q7, Q8)
- Q7 = multiple_choice APPLY VERIFY. "Which of these scenes in [Film A] is an example of [concept]?" Paraphrase options — do not copy the teachStatement.
- Q8 = short_answer APPLY. "Find [concept] in [Film B] — describe one specific moment or technique, in one sentence." maxWords: 18.
- Film B must be different from Film A. acceptableAnswers / acceptableKeywords pulled from Film B's wiki plot and themes.

SECTION 5 — Reflection (Q9) — short_answer
- ONE question. Personal, lightweight, approachable.
- Example stems: "Which moment affected you the most, and how did the film create that impact?", "Has your interpretation changed during this quiz? Why?"
- maxWords: 25.
- This question should NEVER reveal an "answer" — it's reflective. Set revealAnswerAfterFallback: false and skip fallbackMultipleChoice (or make it optional at the schema level).

Schema changes required:
- quizSchema.questions: minItems 9, maxItems 9 (was 8).
- Add a focus value "Compare" to the focus field.
- transferConcept.verifyQuestionId must now be "q7" (was "q6"). applyQuestionId must now be "q8" (was "q7").
- For Q9 (reflection): make fallbackMultipleChoice optional in the schema, or exempt q9 specifically. Pick the cleaner approach and tell me which.
- Update buildQuizPrompt in openai.ts to reflect the new 9-question arc, section headers, and stems above.
- Update buildFallbackQuiz in fallback.ts to produce 9 questions matching the new structure. Two new compare/contrast questions need real fallback content — the system should pick two Top-4 films that share a concept and write the question from that.

Stop. Summarize. Flag any issues you hit. Then move on.

=======================================================================
PHASE 3 — Interaction rules (the behavior fixes)
=======================================================================

The current flow has real problems: MCQ reveals the answer on first wrong try, "idk" gets shallow scaffold, off-topic answers aren't handled well, and the user can't gracefully move on. Fix these.

3A. MULTIPLE CHOICE behavior:
- Two attempts allowed.
- On first wrong answer: show "Not quite — try again." DO NOT reveal the correct answer. DO NOT show a follow-up question (remove the current follow-up-question-on-MCQ behavior entirely).
- On second wrong answer: show a HINT (narrow the options visually by dimming 1-2 obvious-wrong ones, OR show the question's hint text), and allow one more try. Still do not reveal.
- If the third attempt is wrong, move on without revealing the answer. Just say "Let's keep going."
- Never auto-reveal the correct answer on MCQ unless the student explicitly clicks a "Skip this" or "Move on" option.

3B. SHORT ANSWER — "IDK / unsure" handling:
Replace current behavior with:
- "idk", "not sure", "no idea", blank, or very vague input → treated as uncertainty, NOT failure. Do NOT count as an attempt.
- Tutor pauses the normal flow and asks: "What part feels unclear — the film, the concept, or the question?" (or similar — one specific clarifying question, not generic reassurance).
- Based on the student's reply, show the next scaffold step OR define the concept if they ask.
- After handling, return to the original question.
- If the student gives 2-3 consecutive uncertain responses, surface an action row with these options as buttons: [Hint] [Multiple choice version] [Simpler version] [Move on]. Student picks one.
- Do NOT auto-escalate to fallback MC without student choice unless they've said idk 3+ times.

3C. SHORT ANSWER — partial / on-the-right-track handling:
- If the student's answer contains a keyword match OR is 5+ words engaging with the question, it's "partial" — ask ONE targeted follow-up ("You named the theme — now name one specific scene").
- If the student keeps elaborating in the right direction, keep accepting partial credit. Do NOT cut them off after 2 attempts if they're visibly progressing. Track a "making progress" signal (new keywords appearing, word count increasing) and give them an additional attempt when it's true.
- After 2 attempts with no progress signal, surface a "Move on" button as an OPTION — do not force it. The student can keep trying or skip.
- Multiple valid interpretations are acceptable. Do NOT reveal "the answer" as if it's the only correct one. If you reveal anything, frame it as "one possible interpretation" — and only for Q3-Q4 (interpretation). Q5-Q6 (compare) and Q8-Q9 (apply/transfer/reflection) should NEVER reveal a canonical answer.

3D. IRRELEVANT / OFF-TOPIC input:
- If the answer is clearly unrelated (no film keywords, no question keywords, not idk, not a concept question):
  - First time: gently redirect with a simpler version of the question. Give them another try. Do NOT count as an attempt.
  - If it happens again (2-3x), treat it like the repeated-idk procedure: offer [Hint] [Multiple choice version] [Simpler version] [Move on].
- Never shame. Never say "that's not related" harshly.

3E. Prompt language rules for buildQuizPrompt:
Add these explicit instructions to the system prompt:
- "When a student says 'idk' or gives a vague answer, ASK WHAT FEELS UNCLEAR before moving to the next scaffold step. Do not silently advance."
- "Never reveal the correct answer on multiple choice after one wrong attempt."
- "For reflection and compare questions, there is no single correct answer — do not grade them as right/wrong."
- "When giving feedback on a partial answer, name the specific part that was right before asking for more."
- Remove any lingering 'thanks for trying that!' style filler. Feedback must name something specific.
- Keep the existing "identify → interpret → apply → transfer" arc wording but update it to reflect the 5-section structure.

Stop. Summarize. Then move on.

=======================================================================
PHASE 4 — Quiz UI (app/quiz/page.tsx)
=======================================================================

Keep the existing styling. Make these targeted changes:

1. Section header: show the current section name ("Warm-Up", "Interpretation", "Compare", "Transfer", "Reflection") above the question prompt, in the same small-caps style used elsewhere. This gives the student a mental map.

2. Progress: the current progress indicator needs to show both question index AND section (e.g. "Question 3 of 9 · Interpretation").

3. MCQ retry UI: after a wrong answer, keep the options visible and selectable again. Add a subtle "Try again" prompt. After a second wrong answer, visually dim 1-2 obviously-wrong options. Do NOT disable the submit button until they've used all three tries.

4. Repeated-idk action row: render the [Hint] [Multiple choice version] [Simpler version] [Move on] buttons as a horizontal row in the same card style as the answer input — not as a modal.

5. "Move on" availability: after 2 short-answer attempts on any question, make "Move on" always available in the UI — not just after scaffold exhaustion. The student should always have a graceful escape.

6. Remove automatic answer reveal from MCQ entirely. Remove any code path that calls the "revealed" state from an MCQ wrong answer.

7. For Q9 (reflection), the UI should make it clear this is NOT graded. Something like a subtle badge "Reflection — no wrong answers" near the prompt.

8. Hint refresh: add a "Show a different hint" button next to the hint panel for short-answer questions. It cycles through: (a) the question's primary hint, (b) the current scaffold step's hint, (c) a concept definition if one applies. If there's only one hint available, hide the button.

Stop. Summarize.

=======================================================================
AFTER ALL PHASES
=======================================================================

Give me:
1. A bullet list of every file you changed, grouped by phase.
2. Any new types or enum values introduced.
3. Places I may need to update imports or fix type errors.
4. Anything you noticed but did NOT change (flagged as follow-ups).
5. Run `npx next build --webpack` at the end and report the result. If it fails, show me the errors — do not attempt fixes beyond obvious ones without asking.

Do NOT:
- Rewrite the Wikipedia integration.
- Touch the Letterboxd scraping route.
- Change the lesson generation prompt or schema (only quiz).
- Reorganize the file tree.
- Add dependencies unless absolutely required — and if so, as