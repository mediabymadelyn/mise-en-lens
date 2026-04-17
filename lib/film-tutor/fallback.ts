import type { FilmInput, QuizQuestion, TransferSequence, TutorLessonPayload, TutorQuizPayload } from "@/lib/film-tutor/types";
import type { WikiFilmContext } from "@/lib/wikipedia/client";

const TITLE_KEYWORDS = {
  animation: ["spirited", "totoro", "animated", "spider-verse", "shrek", "coraline", "fantastic mr"],
  horror: ["horror", "scream", "hereditary", "midsommar", "get out", "alien", "pearl", "possession"],
  romance: ["before", "love", "moonlight", "portrait", "in the mood", "past lives", "la la land"],
  sciFi: ["2001", "blade runner", "matrix", "interstellar", "arrival", "akira", "children of men"],
  crime: ["godfather", "goodfellas", "heat", "zodiac", "memories of murder", "taxi driver", "se7en"],
};

type TasteArchetype = {
  key: "animation" | "horror" | "romance" | "sciFi" | "crime" | "general";
  conceptName: string;
  conceptExplanation: string;
  conceptConnection: string;
  recommendation: {
    title: string;
    why: string;
    redirect: string;
  };
};

const ARCHETYPES: Record<TasteArchetype["key"], TasteArchetype> = {
  animation: {
    key: "animation",
    conceptName: "Color and visual storytelling",
    conceptExplanation:
      "In animation, color, shape, and movement often do the work that live-action films hand to realism. Tracking how a scene uses palette, rhythm, and framing is a beginner-friendly way to study film form.",
    conceptConnection:
      "Your Top 4 suggests you respond strongly to films where style is not decoration, but the language that carries emotion and theme.",
    recommendation: {
      title: "The Red Turtle",
      why: "It is visually expressive, emotionally accessible, and ideal for noticing how composition and movement can carry meaning.",
      redirect:
        "It gently shifts the lesson toward minimalist visual storytelling, so the recommendation feels educational instead of just adjacent.",
    },
  },
  horror: {
    key: "horror",
    conceptName: "Tension through sound and framing",
    conceptExplanation:
      "Horror teaches one of the clearest film-theory lessons: what the camera hides, delays, or isolates can be as important as what it shows. Sound design, pacing, and negative space guide audience emotion moment by moment.",
    conceptConnection:
      "These selections point toward an interest in mood, dread, and films that use formal choices to shape psychological response.",
    recommendation: {
      title: "Cure",
      why: "It extends the same tension-building habits into a quieter, more analytical style of suspense.",
      redirect:
        "That makes it a strong bridge from enjoying horror to studying atmosphere, ambiguity, and visual restraint.",
    },
  },
  romance: {
    key: "romance",
    conceptName: "Performance, blocking, and emotional point of view",
    conceptExplanation:
      "Character-focused films often teach how performances are shaped by framing, body language, and where people are placed within a scene. Blocking can reveal power, intimacy, hesitation, or emotional distance.",
    conceptConnection:
      "Your favorites suggest that emotional texture and relational nuance matter as much as plot.",
    recommendation: {
      title: "Brief Encounter",
      why: "It is approachable, emotionally rich, and perfect for studying how restraint and staging create feeling.",
      redirect:
        "The film broadens the conversation from contemporary taste into the history of screen romance and classical visual storytelling.",
    },
  },
  sciFi: {
    key: "sciFi",
    conceptName: "World-building through production design",
    conceptExplanation:
      "Science fiction often makes film form easier to notice because every object, space, and texture is deliberately built. Production design, cinematography, and sound help a world feel believable before the story explains it.",
    conceptConnection:
      "Your Top 4 leans toward films where ideas and image-making work together, not separately.",
    recommendation: {
      title: "Gattaca",
      why: "It is a clean, accessible example of how design choices can express theme without overwhelming the viewer.",
      redirect:
        "That makes it useful for connecting speculative storytelling to questions of identity, social control, and visual symbolism.",
    },
  },
  crime: {
    key: "crime",
    conceptName: "Editing, perspective, and moral framing",
    conceptExplanation:
      "Crime and thriller films often teach how editing and point of view shape judgment. The order of shots, who gets close-ups, and when information is withheld all influence how viewers interpret guilt, power, or sympathy.",
    conceptConnection:
      "Your picks suggest an interest in films that balance tension with character study and ethical ambiguity.",
    recommendation: {
      title: "Le Samourai",
      why: "It strips the genre down to image, rhythm, and behavior, which makes its formal choices especially easy to study.",
      redirect:
        "That helps redirect taste from plot momentum toward style, silence, and cinematic minimalism.",
    },
  },
  general: {
    key: "general",
    conceptName: "Mise-en-scene",
    conceptExplanation:
      "Mise-en-scene is the study of everything placed in front of the camera: lighting, costumes, actors, props, and composition. It is one of the most useful beginner concepts because it turns film-watching into close observation.",
    conceptConnection:
      "Even with a mixed Top 4, your selections still reveal a taste for movies that feel intentional in mood, design, and point of view.",
    recommendation: {
      title: "Do the Right Thing",
      why: "It is vivid, accessible, and full of clear visual choices that connect style to social meaning.",
      redirect:
        "That makes it a strong next step for learning how form, community, and historical context can work together.",
    },
  },
};

function detectArchetype(titles: string[]): TasteArchetype {
  const lowered = titles.map((title) => title.toLowerCase());
  const matches = Object.entries(TITLE_KEYWORDS).map(([key, words]) => ({
    key: key as TasteArchetype["key"],
    count: words.reduce(
      (total, word) => total + (lowered.some((title) => title.includes(word)) ? 1 : 0),
      0
    ),
  }));

  const winner = matches.sort((a, b) => b.count - a.count)[0];
  if (!winner || winner.count === 0) {
    return ARCHETYPES.general;
  }

  return ARCHETYPES[winner.key];
}

function buildFilmNote(
  film: FilmInput,
  index: number,
  archetype: TasteArchetype,
  wikiCtx?: WikiFilmContext | null
) {
  const defaultSummary =
    index === 0
      ? `This pick likely acts as a cornerstone for your taste, which makes it a useful starting point for discussing how film style shapes interpretation.`
      : `This selection reinforces the pattern in your Top 4 by adding another example of how mood, genre, and point of view can teach us to read movies more closely.`;

  let summary = defaultSummary;
  if (wikiCtx?.plot) {
    summary = `${wikiCtx.plot.split(". ").slice(0, 3).join(". ")}. This makes it a useful reference point for studying how film style shapes interpretation.`;
  } else if (wikiCtx?.extract) {
    summary = `${wikiCtx.extract.split(". ").slice(0, 2).join(". ")}. This makes it a useful reference point for studying how film style shapes interpretation.`;
  }

  return {
    title: film.title,
    summary,
    artisticElements:
      archetype.key === "animation"
        ? "Pay attention to palette, movement, and how the frame guides your eye before any dialogue explains what matters."
        : archetype.key === "horror"
          ? "Notice how framing, off-screen space, and sound cues build tension even before a scene delivers a payoff."
          : archetype.key === "romance"
            ? "Watch how performance, blocking, and camera distance communicate intimacy or emotional hesitation."
            : archetype.key === "sciFi"
              ? "Production design, lighting, and world-building details are especially important here because they carry thematic meaning."
              : archetype.key === "crime"
                ? "Editing rhythm, selective information, and shifting perspective can change how you judge characters."
                : "Look at the film through mise-en-scene: setting, color, performance, and camera placement all contribute to interpretation.",
    societalContext:
      "A useful next step is to ask what broader anxieties, values, or cultural conversations this film reflects, and how its style helps deliver that perspective to the viewer.",
  };
}

function buildQuizQuestions(films: FilmInput[], archetype: TasteArchetype): QuizQuestion[] {
  const filmA = films[0]?.title ?? "one of your favorites";
  const filmB = films[1]?.title ?? "another film in your Top 4";
  const filmC = films[2]?.title ?? "a third favorite";

  return [
    // Q1 — Recognition, multiple choice: easy fact from filmA
    {
      id: "q1",
      questionType: "multiple_choice",
      prompt: `What best describes the genre or style of ${filmA}?`,
      focus: "Recognition",
      hint: "Think about how the film feels overall — its genre or the type of story it tells.",
      explanation: "Recognizing genre helps you know what visual and narrative tools to expect.",
      options: [
        archetype.key === "animation"
          ? "Animated feature with an emotional, visually expressive story"
          : archetype.key === "horror"
            ? "A horror film that uses atmosphere and tension over jump scares"
            : archetype.key === "romance"
              ? "A romantic drama focused on emotional relationships and intimacy"
              : archetype.key === "sciFi"
                ? "A science-fiction film exploring ideas through visual world-building"
                : archetype.key === "crime"
                  ? "A crime or thriller film with moral ambiguity and tension"
                  : "A drama with a strong point of view and intentional visual style",
        "A fast-paced action blockbuster with big set pieces",
        "A documentary focused on historical events",
        "A comedy built around improvised dialogue",
      ],
      correctAnswer:
        archetype.key === "animation"
          ? "Animated feature with an emotional, visually expressive story"
          : archetype.key === "horror"
            ? "A horror film that uses atmosphere and tension over jump scares"
            : archetype.key === "romance"
              ? "A romantic drama focused on emotional relationships and intimacy"
              : archetype.key === "sciFi"
                ? "A science-fiction film exploring ideas through visual world-building"
                : archetype.key === "crime"
                  ? "A crime or thriller film with moral ambiguity and tension"
                  : "A drama with a strong point of view and intentional visual style",
      correctFeedback: "Correct. That's the genre foundation — now you can notice which techniques go with it.",
      partialFeedback: "Close. Look at the genre more broadly — what category of film does it belong to?",
      incorrectFeedback: "Not quite. Think about the overall type of story and how it makes you feel.",
    },
    // Q2 — Recognition, multiple choice: mood/tone of filmA
    {
      id: "q2",
      questionType: "multiple_choice",
      prompt: `Which of these best describes the mood or tone of ${filmA}?`,
      focus: "Recognition",
      hint: "Think about the feeling the film leaves you with — not the plot, the atmosphere.",
      explanation: "Identifying tone is a first step toward noticing which techniques create it.",
      options:
        archetype.key === "horror"
          ? [
              "Slow-building dread with unsettling silence and off-screen threat",
              "Playful and light, with upbeat music and bright visuals",
              "Epic and triumphant, building toward a hopeful ending",
              "Nostalgic and warm, focused on childhood memory",
            ]
          : archetype.key === "romance"
            ? [
                "Intimate and melancholic, with long pauses and restrained performance",
                "Loud and chaotic, driven by confrontation and action",
                "Satirical and comedic, mocking its own genre conventions",
                "Urgent and thriller-like, with fast cuts and rising stakes",
              ]
            : archetype.key === "sciFi"
              ? [
                  "Cold and contemplative, using visual design to express ideas",
                  "Warm and nostalgic, centered on family and belonging",
                  "Comedic and fast-paced, with slapstick and exaggeration",
                  "Romantic and emotional, driven by personal loss",
                ]
              : archetype.key === "crime"
                ? [
                    "Tense and morally ambiguous, with slow reveals and ethical weight",
                    "Optimistic and energetic, with clear heroes and villains",
                    "Dreamlike and surreal, ignoring narrative logic",
                    "Comedic and self-aware, playing with genre clichés",
                  ]
                : [
                    "Deliberate and atmospheric, rewarding close attention",
                    "Fast and surface-level, focused purely on entertainment",
                    "Chaotic and improvised, with no clear visual intent",
                    "Nostalgic and crowd-pleasing, avoiding difficult emotions",
                  ],
      correctAnswer:
        archetype.key === "horror"
          ? "Slow-building dread with unsettling silence and off-screen threat"
          : archetype.key === "romance"
            ? "Intimate and melancholic, with long pauses and restrained performance"
            : archetype.key === "sciFi"
              ? "Cold and contemplative, using visual design to express ideas"
              : archetype.key === "crime"
                ? "Tense and morally ambiguous, with slow reveals and ethical weight"
                : "Deliberate and atmospheric, rewarding close attention",
      correctFeedback: "Yes. You identified the tone — that's the starting point for reading technique.",
      partialFeedback: "You're in the right area. Think specifically about the atmosphere, not the story.",
      incorrectFeedback: `Not quite. Think about how ${filmA} makes you feel, not what happens in it.`,
    },
    // Q3 — Interpretation: identify a theme in filmB (one task only)
    {
      id: "q3",
      questionType: "short_answer",
      prompt: `What is one theme in ${filmB}? Name it and point to one specific character or moment that shows it.`,
      focus: "Interpretation",
      hint: "A theme is a big idea the film keeps returning to — try: identity, power, family, memory, or belonging. Then name one character or scene where that idea appears.",
      explanation: "Naming a theme with a concrete anchor shows you're reading beyond plot.",
      maxWords: 14,
      placeholder: "Family — the film keeps showing characters who can't escape their parents' choices.",
      acceptableAnswers: [
        "identity", "power", "family", "memory", "belonging",
        "loss", "class", "gender", "violence", "freedom",
      ],
      acceptableKeywords: [
        "identity", "power", "family", "memory", "belonging",
        "loss", "explores", "shows", "character", "moment",
      ],
      correctFeedback: "Good — you named a theme and grounded it in something specific from the film.",
      partialFeedback: "You named the theme — now add one character or scene that shows it.",
      incorrectFeedback: "Pick one theme word (identity, power, family) and name one moment in the film where it appears.",
      scaffoldSteps: [
        {
          prompt: `Just name one theme in ${filmB} — one word or short phrase is fine.`,
          hint: "Try one of these: identity, power, family, memory, belonging, loss.",
          expectedFocus: "identifies a named theme",
        },
        {
          prompt: `Good. Now name one character or scene in ${filmB} that shows that theme.`,
          hint: `Think about a specific moment — who is in it, and what are they doing or going through?`,
          expectedFocus: "grounds theme in a concrete story element",
        },
      ],
      fallbackMultipleChoice: {
        prompt: `Which of these is a theme in ${filmB}?`,
        options: ["Identity and belonging", "Space travel and technology", "Medieval warfare"],
        correctAnswer: "Identity and belonging",
        explanation: "Identity and belonging are the themes most character-driven films keep returning to.",
      },
      revealAnswerAfterFallback: true,
    },
    // Q4 — Interpretation: scene + what it shows in filmB
    {
      id: "q4",
      questionType: "short_answer",
      prompt: `Pick one specific scene or moment in ${filmB}. What does it show about a character or the film's theme?`,
      focus: "Interpretation",
      hint: `Name the scene first — who is in it, what happens. Then say what it reveals about the character or the theme.`,
      explanation: "Connecting a specific scene to a character or theme is the core move in film analysis.",
      maxWords: 18,
      placeholder: "When the protagonist refuses to leave, it shows that belonging matters more to them than safety.",
      acceptableAnswers: [
        "close-up", "silence", "color", "framing", "sound",
        "editing", "lighting", "character", "moment", "scene",
      ],
      acceptableKeywords: [
        "shows", "reveals", "tells", "character", "theme",
        "moment", "scene", "because", "when", "how",
      ],
      correctFeedback: "Exactly — you connected a specific moment to what the film is saying.",
      partialFeedback: "You named a moment — now say what it shows about the character or the theme.",
      incorrectFeedback: "Pick one scene and say what it reveals — not just what happens, but what it means.",
      scaffoldSteps: [
        {
          prompt: `Name one specific scene or moment in ${filmB} — just describe what happens.`,
          hint: "Don't worry about analysis yet. Just name the scene: who is in it, what do they do.",
          expectedFocus: "identifies a concrete scene",
        },
        {
          prompt: `What does that scene show about the character or theme? What is the film saying through it?`,
          hint: "Ask yourself: why did the director include this moment? What do they want you to understand?",
          expectedFocus: "interprets scene as meaningful, not just descriptive",
        },
      ],
      fallbackMultipleChoice: {
        prompt: `Which of these best describes what a scene in ${filmB} might show?`,
        options: [
          "A character who can't let go of the past, showing a theme of memory",
          "The film's budget affecting the set design",
          "The director's personal biography",
        ],
        correctAnswer: "A character who can't let go of the past, showing a theme of memory",
        explanation: "Scenes reveal character and theme when a director chooses to linger on them — that's the connection to look for.",
      },
      revealAnswerAfterFallback: true,
    },
    // Q5 — Analysis: technique + what it communicates in filmC
    {
      id: "q5",
      questionType: "short_answer",
      prompt: `In ${filmC}, name one specific visual or storytelling technique. What does the director show about the character or theme through it?`,
      focus: "Analysis",
      hint: "Try: close-up, silence, color, framing, slow motion, or editing pace. Name it, then say what it communicates — not just what it feels like.",
      explanation: "Naming technique and purpose is the move that turns description into film analysis.",
      maxWords: 18,
      placeholder: "Repeated close-ups on hands show that control is the film's central theme.",
      acceptableAnswers: [
        "close-up", "silence", "color", "framing", "editing",
        "lighting", "slow motion", "sound design", "wide shot", "pacing",
      ],
      acceptableKeywords: [
        "shows", "communicates", "reveals", "director", "technique",
        "character", "theme", "means", "through", "when",
      ],
      correctFeedback: "Good — you named a technique and explained what the director is communicating through it.",
      partialFeedback: "You named the technique — now say what the director is showing about the character or theme through it.",
      incorrectFeedback: "Pick one thing you see or hear on screen, name it, then say what the director is arguing through it.",
      scaffoldSteps: [
        {
          prompt: `Name one technique you notice in ${filmC} — one word or short phrase (close-up, silence, color, framing).`,
          hint: "Pick something concrete you can see or hear on screen. Gut feeling is fine at this step.",
          expectedFocus: "names a specific technique",
        },
        {
          prompt: `Good. What is the director showing about the character or the theme by using that technique?`,
          hint: "Ask: why would a director make that choice? What do they want you to understand?",
          expectedFocus: "connects technique to director's intent or thematic meaning",
        },
        {
          prompt: `Can you name a specific scene in ${filmC} where you see that technique? Describe it briefly.`,
          hint: "Just name the moment — who is in it, what's happening on screen.",
          expectedFocus: "grounds the technique in a concrete scene",
        },
      ],
      fallbackMultipleChoice: {
        prompt: `Which of these describes a director using technique deliberately?`,
        options: [
          "A close-up on a character's face to make you feel their fear",
          "The film's running time",
          "The country where the film was shot",
        ],
        correctAnswer: "A close-up on a character's face to make you feel their fear",
        explanation: "Close-ups are a deliberate choice — the director decides to exclude the world and put you inside the character's experience.",
      },
      revealAnswerAfterFallback: true,
    },
    // Q6 — Transfer VERIFY (multiple choice) — placeholder, overwritten by buildFallbackQuiz with TransferSequence
    {
      id: "q6",
      questionType: "multiple_choice",
      prompt: `Which of these in ${filmA} is an example of using framing to create emotional focus?`,
      focus: "Apply",
      hint: "Think about a moment where the camera placement affected what you noticed or felt.",
      explanation: "Recognizing a specific technique in context shows you can read film, not just describe it.",
      options: [
        "A tight close-up on a character's face during a moment of fear",
        "A wide establishing shot introducing a new location",
        "A cut to the next scene before the moment resolves",
        "Background music swelling during a speech",
      ],
      correctAnswer: "A tight close-up on a character's face during a moment of fear",
      correctFeedback: "Yes. That's framing creating emotional focus — the concept in action.",
      partialFeedback: "Focus on what the framing does to your attention, not just what it shows.",
      incorrectFeedback: "Think about what tight framing does to the viewer's focus and feeling.",
    },
    // Q7 — Transfer APPLY (short answer) — placeholder, overwritten by buildFallbackQuiz with TransferSequence
    {
      id: "q7",
      questionType: "short_answer",
      prompt: `Now find the same concept in ${filmB} — describe one specific moment or technique in one sentence.`,
      focus: "Apply",
      hint: "Use the same lens from the teach block, but look at a different film.",
      explanation: "Transfer means taking a concept you learned and finding it somewhere new.",
      maxWords: 18,
      placeholder: `In ${filmB}, a close-up during a key scene puts you inside the character's experience.`,
      acceptableAnswers: [
        "close-up", "framing", "silence", "sound", "color",
        "lighting", "editing", "pacing", "moment", "technique",
      ],
      acceptableKeywords: [
        "close-up", "framing", "silence", "sound", "creates",
        "shows", "scene", "moment", "technique", "character",
      ],
      correctFeedback: "Correct — you applied the concept to a new film. That's the transfer.",
      partialFeedback: `You described a moment — name the specific technique or craft choice that makes it work in ${filmB}.`,
      incorrectFeedback: `Pick one specific moment in ${filmB} and say what technique is used and what it shows.`,
      scaffoldSteps: [
        {
          prompt: `Think about ${filmB}. Is there a scene that felt important or stood out? Just describe it briefly.`,
          hint: "Don't worry about technique yet — just name the scene. Who is in it, what happens.",
          expectedFocus: "locates a concrete scene in Film B",
        },
        {
          prompt: `What technique does the director use in that scene — and what does it show?`,
          hint: "Look for: close-up, framing, silence, color, editing pace. Then say what the director is communicating.",
          expectedFocus: "connects technique to meaning in Film B",
        },
      ],
      fallbackMultipleChoice: {
        prompt: `Which of these shows a craft technique being used deliberately in ${filmB}?`,
        options: [
          "A close-up that focuses attention on a character's emotion",
          "The film's running time",
          "The country where the film was made",
        ],
        correctAnswer: "A close-up that focuses attention on a character's emotion",
        explanation: "Close-ups are one of the most direct ways a director guides what you pay attention to.",
      },
      revealAnswerAfterFallback: false,
    },
    // Q8 — Transfer SYNTHESIS (short answer) — placeholder, overwritten by buildFallbackQuiz
    {
      id: "q8",
      questionType: "short_answer",
      prompt: `You've seen this concept in ${filmA} and ${filmB}. In both cases, what is the director trying to make you understand or feel?`,
      focus: "Transfer",
      hint: `Think about what both films have in common — not what happens, but what the director is doing to you as a viewer. What's the shared purpose?`,
      explanation: "Transfer means you can name a concept, find it in multiple films, and say what it does — that's the capstone of film literacy.",
      maxWords: 20,
      placeholder: `In both films, the director uses tight framing to make personal struggle feel inescapable.`,
      acceptableAnswers: [
        "both", "director", "viewer", "understand", "feel",
        "shows", "creates", "purpose", "technique", "meaning",
      ],
      acceptableKeywords: [
        "both", "same", "director", "shows", "creates",
        "feel", "understand", "technique", "viewer", "meaning",
      ],
      correctFeedback: "Excellent — you drew a cross-film conclusion about what the technique does. That's film literacy.",
      partialFeedback: "You named what happens in one film — now say what both films are doing with the same idea.",
      incorrectFeedback: "Think about the shared purpose: what does the director in both cases want you to understand or feel?",
      scaffoldSteps: [
        {
          prompt: `You've seen this concept in both films. What does it do in ${filmA} — what does the director want you to feel?`,
          hint: `Think about a specific moment in ${filmA} and what the director chose to show you through it.`,
          expectedFocus: "articulates director intent in Film A",
        },
        {
          prompt: `Does the same concept do something similar in ${filmB}? Say what the director is communicating there too.`,
          hint: `You don't need new words — just say what the director in ${filmB} wants you to understand through the same technique.`,
          expectedFocus: "articulates director intent in Film B and begins comparing",
        },
      ],
      fallbackMultipleChoice: {
        prompt: `What do directors usually want you to feel when they use this technique repeatedly across a film?`,
        options: [
          "A deeper connection to the character or theme — you're being drawn inside their world",
          "Confusion — they want you to lose track of the story",
          "Distance — they want you to stay detached and analytical",
        ],
        correctAnswer: "A deeper connection to the character or theme — you're being drawn inside their world",
        explanation: "Repeated use of a technique is never accidental — directors use it to make you feel what the character feels, or to keep returning your attention to the film's central idea.",
      },
      revealAnswerAfterFallback: false,
    },
  ];
}

const FILM_KEYWORDS = new Set([
  "cinematography", "noir", "expressionism", "surrealism", "realism",
  "neorealism", "montage", "suspense", "thriller", "dystopia", "satire",
  "allegory", "symbolism", "minimalism", "postmodern", "avant-garde",
  "documentary", "narrative", "protagonist", "antagonist", "soundtrack",
]);

const STOP_WORDS = new Set([
  "the", "and", "for", "its", "his", "her", "was", "are", "has", "had",
  "but", "not", "this", "that", "with", "from", "into", "also", "been",
  "they", "their", "which", "when", "where", "who", "how", "all", "each",
  "she", "him", "them", "than", "then", "only", "very", "can", "will",
]);

function extractWikiKeywords(extract: string): string[] {
  const words = extract.split(/[\s,;:.!?()\[\]"]+/).filter(Boolean);
  const keywords = new Set<string>();

  for (const word of words) {
    const lower = word.toLowerCase();
    if (lower.length < 3 || STOP_WORDS.has(lower)) continue;

    if (FILM_KEYWORDS.has(lower)) {
      keywords.add(lower);
      continue;
    }
    if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      keywords.add(lower);
    }
  }

  return [...keywords];
}

function enrichQuizKeywords(
  questions: QuizQuestion[],
  films: FilmInput[],
  wikiContext: Map<string, WikiFilmContext | null>
): QuizQuestion[] {
  const allWikiKeywords: string[] = [];
  for (const film of films) {
    const ctx = wikiContext.get(film.title);
    if (!ctx) continue;
    allWikiKeywords.push(...extractWikiKeywords(ctx.extract));
    if (ctx.plot) allWikiKeywords.push(...extractWikiKeywords(ctx.plot));
    if (ctx.themes) allWikiKeywords.push(...extractWikiKeywords(ctx.themes));
  }

  if (allWikiKeywords.length === 0) return questions;

  return questions.map((q) => {
    if (q.questionType !== "short_answer") return q;

    const existingAnswers = new Set(q.acceptableAnswers.map((a) => a.toLowerCase()));
    const existingKeywords = new Set(q.acceptableKeywords.map((k) => k.toLowerCase()));

    const newAnswers = allWikiKeywords
      .filter((kw) => !existingAnswers.has(kw))
      .slice(0, 6 - q.acceptableAnswers.length);
    const newKeywords = allWikiKeywords
      .filter((kw) => !existingKeywords.has(kw))
      .slice(0, 10 - q.acceptableKeywords.length);

    return {
      ...q,
      acceptableAnswers: [...q.acceptableAnswers, ...newAnswers],
      acceptableKeywords: [...q.acceptableKeywords, ...newKeywords],
    };
  });
}

export function buildFallbackLesson(
  films: FilmInput[],
  wikiContext?: Map<string, WikiFilmContext | null>
): TutorLessonPayload {
  const titles = films.map((film) => film.title);
  const archetype = detectArchetype(titles);
  const tasteProfile = [
    "You seem drawn to movies with a strong point of view rather than purely passive entertainment.",
    "Your Top 4 suggests you value atmosphere, style, and the feeling a film leaves behind.",
    "This mix is well-suited for learning film theory because the selections invite discussion about form as well as story.",
  ];

  return {
    headline: "Your Top 4 already functions like a film-studies syllabus.",
    overview:
      "Instead of treating favorite movies as isolated picks, Mise-en-Lens reads them as a pattern. The goal is to help you connect taste to craft, context, and transferable film-literacy skills.",
    tasteProfile,
    concept: {
      name: archetype.conceptName,
      explanation: archetype.conceptExplanation,
      connection: archetype.conceptConnection,
    },
    filmNotes: films.map((film, index) =>
      buildFilmNote(film, index, archetype, wikiContext?.get(film.title))
    ),
    recommendation: {
      title: archetype.recommendation.title,
      whyYouMightLikeIt: archetype.recommendation.why,
      educationalRedirect: archetype.recommendation.redirect,
    },
  };
}

function buildTransferSequence(
  films: FilmInput[],
  archetype: TasteArchetype,
  wikiContext?: Map<string, WikiFilmContext | null>
): TransferSequence {
  const filmA = films[0]?.title ?? "your first favorite";
  const filmB = films[1]?.title ?? "another film in your Top 4";
  const ctxA = wikiContext?.get(filmA);
  const ctxB = wikiContext?.get(filmB);

  const concept = archetype.conceptName;

  // Build teach statement from Film A's wiki context when available
  let teachStatement: string;
  let verifyCorrectAnswer: string;
  let applyKeywords: string[];

  if (ctxA?.plot || ctxA?.extract) {
    const source = ctxA.plot ?? ctxA.extract;
    // Take first two sentences of plot/extract as the concrete example
    const sentences = source.split(/(?<=[.!?])\s+/);
    const exampleSentence = sentences.slice(0, 2).join(" ");
    teachStatement = `In ${filmA}, ${concept.toLowerCase()} shapes how the viewer experiences each scene. ` +
      `You can see this when: ${exampleSentence.slice(0, 200)}`;
    verifyCorrectAnswer = `A moment in ${filmA} where ${concept.toLowerCase()} directs your attention`;
  } else {
    // Generic fallback when wiki is missing
    teachStatement = `In ${filmA}, ${concept.toLowerCase()} shows up as specific craft choices that guide what you notice and feel. ` +
      `Look for moments where the director uses framing, sound, or color to focus your attention on something specific. ` +
      `These are the moments where technique becomes meaning.`;
    verifyCorrectAnswer = `A moment in ${filmA} where a craft choice guides your attention`;
  }

  // Build apply keywords from Film B's wiki context when available
  if (ctxB?.plot || ctxB?.themes) {
    const source = (ctxB.plot ?? "") + " " + (ctxB.themes ?? "");
    applyKeywords = extractWikiKeywords(source).slice(0, 8);
  } else {
    applyKeywords = ["framing", "silence", "color", "sound", "close-up", "lighting"];
  }

  return {
    concept,
    filmA,
    filmB,
    teachStatement,
    verifyQuestionId: "q6",
    applyQuestionId: "q7",
    // Store derived values on the sequence for use when building Q5/Q6
    _verifyCorrectAnswer: verifyCorrectAnswer,
    _applyKeywords: applyKeywords,
  } as TransferSequence & { _verifyCorrectAnswer: string; _applyKeywords: string[] };
}

export function buildFallbackQuiz(
  films: FilmInput[],
  wikiContext?: Map<string, WikiFilmContext | null>
): TutorQuizPayload {
  const archetype = detectArchetype(films.map((film) => film.title));
  const filmA = films[0]?.title ?? "your first favorite";
  const filmB = films[1]?.title ?? "another film in your Top 4";

  const baseQuestions = buildQuizQuestions(films, archetype);
  const enriched = wikiContext
    ? enrichQuizKeywords(baseQuestions, films, wikiContext)
    : baseQuestions;

  const transferSeq = buildTransferSequence(films, archetype, wikiContext);
  const { _applyKeywords } = transferSeq as TransferSequence & {
    _verifyCorrectAnswer: string;
    _applyKeywords: string[];
  };

  // Overwrite Q6 (verify MC) and Q7 (apply SA) with TransferSequence-specific content
  const questions: QuizQuestion[] = enriched.map((q) => {
    if (q.id === "q6") {
      // Build four plausible scene descriptions — correct answer paraphrases, never copies, the teachStatement.
      const correctOption = `A scene in ${filmA} where a character relationship directly shapes the outcome`;
      return {
        id: "q6",
        questionType: "multiple_choice",
        prompt: `Which of these in ${filmA} best shows ${transferSeq.concept.toLowerCase()} at work?`,
        focus: "Apply",
        hint: `Think about which option describes something that involves the characters directly — not just plot mechanics or background detail.`,
        explanation: "Recognizing the concept in a specific scene shows you can read film, not just name ideas.",
        options: [
          correctOption,
          `A moment where a character discovers new information that changes the plot`,
          `A scene that introduces a secondary character who doesn't affect the main story`,
          `An opening sequence that establishes the film's setting and time period`,
        ],
        correctAnswer: correctOption,
        correctFeedback: `Yes — that kind of scene is where ${transferSeq.concept.toLowerCase()} actually lives in ${filmA}.`,
        partialFeedback: "Think about which option describes characters actively affecting each other, not just story mechanics.",
        incorrectFeedback: `Look for the option where characters are directly shaping what happens — that's where ${transferSeq.concept.toLowerCase()} shows up.`,
      } satisfies QuizQuestion;
    }

    if (q.id === "q7") {
      const applyKeywords = _applyKeywords.length > 0
        ? _applyKeywords
        : ["framing", "silence", "color", "sound", "close-up", "family", "moment"];
      return {
        id: "q7",
        questionType: "short_answer",
        prompt: `Now find ${transferSeq.concept.toLowerCase()} in ${filmB} — describe one specific moment or technique in one sentence.`,
        focus: "Apply",
        hint: `Describe one specific scene in ${filmB}. You don't need a technical term — just name what happens and what it shows.`,
        explanation: "Transfer means taking what you learned and finding it somewhere new.",
        maxWords: 18,
        placeholder: `When [character] does [something], it shows ${transferSeq.concept.toLowerCase()} because [brief reason].`,
        acceptableAnswers: applyKeywords.slice(0, 4),
        acceptableKeywords: applyKeywords,
        correctFeedback: `Yes — you found a specific example in ${filmB}. That's the transfer.`,
        partialFeedback: `You described a moment — now name the specific craft choice or relationship that makes ${transferSeq.concept.toLowerCase()} visible there.`,
        incorrectFeedback: `Describe one specific scene in ${filmB}: who is in it, what happens, and what it shows about ${transferSeq.concept.toLowerCase()}.`,
        scaffoldSteps: [
          {
            prompt: `Think about ${filmB}. Is there any scene that felt important or stood out? Just describe it.`,
            hint: "Don't worry about technique yet — just name the scene. Who is in it, what are they doing.",
            expectedFocus: "locates a concrete scene in Film B",
          },
          {
            prompt: `What technique or craft choice does the director use in that scene — and what does it show?`,
            hint: `Look for: framing, silence, color, editing pace. Then say what the director is communicating through it.`,
            expectedFocus: "connects technique to meaning in Film B",
          },
        ],
        fallbackMultipleChoice: {
          prompt: `Which of these best describes a moment of ${transferSeq.concept.toLowerCase()} in ${filmB}?`,
          options: [
            `A scene where a character relationship is tested or shaped`,
            `A scene where a character learns something from a newspaper`,
            `The opening credits sequence`,
          ],
          correctAnswer: `A scene where a character relationship is tested or shaped`,
          explanation: `${transferSeq.concept} shows up whenever characters actively affect each other — that's the moment to find.`,
        },
        revealAnswerAfterFallback: false,
      } satisfies QuizQuestion;
    }

    return q;
  });

  // Strip the private fields before returning
  const { _verifyCorrectAnswer: _v, _applyKeywords: _a, ...cleanTransfer } = transferSeq as TransferSequence & {
    _verifyCorrectAnswer: string;
    _applyKeywords: string[];
  };
  void _v; void _a;

  return {
    title: "Practice with your Top 4",
    intro:
      "Eight prompts: two recognition questions, three interpretation and analysis questions, two application questions, and one transfer question. Keep each short answer to one sentence.",
    transferConcept: cleanTransfer,
    questions,
  };
}
