# Test Scenarios

15 scenarios used for prompt optimization evaluation across all versions.
Each scenario was held constant across v0 through v4 so score changes could be attributed to prompt changes rather than input differences.

## Rubric (10 points per scenario)

| Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Accuracy | Major inaccuracies or hallucinations | Some incorrect or misleading information | Mostly accurate with minor omissions | All details correct and relevant |
| Pedagogical Response | Gives answer directly with no engagement | Mostly gives answers directly | Provides explanation but limited scaffolding | Guides user with follow-up question or hint |
| Clarity and Structure | Disorganized | Some structure but inconsistent | Clearly structured and easy to follow | n/a |
| Personalization | No meaningful personalization | Shallow reference to user input | Meaningfully connects to user's Top 4 | n/a |

---

## Blurb Mode Scenarios

### Scenario 1 — Varied Mainstream Top 4
**Input:** Juno, Get Out, Little Miss Sunshine, Ponyo
**Mode:** Blurb
**Skill tested:** Baseline personalization
**Why included:** Most common user case

### Scenario 2 — Horror Cluster
**Input:** Get Out, Hereditary, Midsommar, The Babadook
**Mode:** Blurb
**Skill tested:** Thematic synthesis across a genre
**Why included:** Tests whether the model can identify nuanced differences within a genre rather than repeating the same horror tropes

### Scenario 3 — International Films
**Input:** Parasite, Spirited Away, Pan's Labyrinth, Amelie
**Mode:** Blurb
**Skill tested:** Breadth and accuracy for non-Hollywood films
**Why included:** Tests hallucination risk and Wikipedia grounding quality for less-covered films

### Scenario 4 — Animation-Heavy
**Input:** Ponyo, Spider-Man: Into the Spider-Verse, Coraline, The Mitchells vs. the Machines
**Mode:** Blurb
**Skill tested:** Artistic analysis specific to animation as a medium
**Why included:** Tests whether the model can speak to animation technique rather than defaulting to generic film analysis

### Scenario 5 — Blockbusters
**Input:** Avengers: Endgame, Jurassic Park, The Dark Knight, Inception
**Mode:** Blurb
**Skill tested:** Accessibility and beginner-friendly framing
**Why included:** Tests whether the model can find educational value in mainstream crowd-pleasers

### Scenario 6 — Art-House
**Input:** Eternal Sunshine of the Spotless Mind, Lost in Translation, Her, Moonlight
**Mode:** Blurb
**Skill tested:** Subtle interpretation and tone matching
**Why included:** Tests whether the model can handle abstract thematic content without oversimplifying

### Scenario 7 — Mixed Taste
**Input:** Clueless, No Country for Old Men, Ratatouille, 2001: A Space Odyssey
**Mode:** Blurb
**Skill tested:** Synthesis across wildly different genres and tones
**Why included:** Hardest personalization case; tests whether the model finds a genuine throughline

### Scenario 8 — Incomplete Input
**Input:** Only 2 films provided instead of 4
**Mode:** Blurb
**Skill tested:** Robustness to missing data
**Why included:** Real-world edge case; not all users will have a full Top 4

### Scenario 9 — Vague Input
**Input:** Film titles that are ambiguous or very short (e.g. "It", "Her", "Us")
**Mode:** Blurb
**Skill tested:** Ambiguity handling
**Why included:** Tests whether the model resolves to the correct film or hallucinates

---

## Quiz Mode Scenarios

### Scenario 10 — Correct Answer
**Input:** Juno, Get Out, Little Miss Sunshine, Ponyo
**Quiz answer:** A fully correct, well-articulated response to a theme question
**Skill tested:** Feedback quality on success
**Why included:** Confirms the system affirms correctly and moves on cleanly without being generic

### Scenario 11 — Partial Answer
**Input:** Juno, Get Out, Little Miss Sunshine, Ponyo
**Quiz answer:** "Family" (one-word response to a theme question)
**Skill tested:** Scaffolding on partial understanding
**Why included:** Tests whether the system asks for a specific scene rather than accepting or rejecting outright

### Scenario 12 — Wrong Answer
**Input:** Juno, Get Out, Little Miss Sunshine, Ponyo
**Quiz answer:** A response that addresses the wrong film entirely
**Skill tested:** Guided correction without answer reveal
**Why included:** Tests whether the model redirects without giving away the correct response

### Scenario 13 — I Don't Know
**Input:** Juno, Get Out, Little Miss Sunshine, Ponyo
**Quiz answer:** "idk" or "I don't know"
**Skill tested:** Beginner support and idk handling
**Why included:** Tests whether the system simplifies the question or repeats it unhelpfully

### Scenario 14 — Recommendation Quality
**Input:** Get Out, Hereditary, Midsommar, The Babadook
**Mode:** Blurb
**Skill tested:** Recommendation relevance and educational redirection
**Why included:** Tests whether the recommendation connects meaningfully to taste and teaches something new

### Scenario 15 — Obscure Films
**Input:** Jeanne Dielman, Stalker, Sans Soleil, Wavelength
**Mode:** Blurb
**Skill tested:** Hallucination control for films with sparse Wikipedia coverage
**Why included:** Stress test for the Wikipedia grounding system