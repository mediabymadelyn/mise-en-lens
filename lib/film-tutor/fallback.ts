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
  const concept = archetype.conceptName;

  return [
    // Q1 — Warm-Up, multiple choice: analytical question about filmA
    {
      id: "q1",
      questionType: "multiple_choice",
      prompt: `What does the visual style of ${filmA} most strongly suggest about the story's themes?`,
      focus: "Warm-Up",
      hint: "Think about the overall mood the film's look creates — color palette, how scenes are lit, the pace of cuts.",
      explanation: "Visual style is the director's argument — how a film looks is inseparable from what it means.",
      options: [
        archetype.key === "animation"
          ? "That emotion and identity can be communicated purely through color, shape, and movement"
          : archetype.key === "horror"
            ? "That danger and dread live in what the frame withholds, not just what it shows"
            : archetype.key === "romance"
              ? "That intimacy and distance are visible in how bodies and space are arranged on screen"
              : archetype.key === "sciFi"
                ? "That ideas and power structures can be embodied in the look and design of a world"
                : archetype.key === "crime"
                  ? "That moral ambiguity is visible in lighting, framing, and whose perspective we share"
                  : "That how a film looks is inseparable from what it is trying to say",
        "That big-budget production values are what make a film effective",
        "That realism is always more emotionally effective than stylization",
        "That visual choices are purely decorative and secondary to plot",
      ],
      correctAnswer:
        archetype.key === "animation"
          ? "That emotion and identity can be communicated purely through color, shape, and movement"
          : archetype.key === "horror"
            ? "That danger and dread live in what the frame withholds, not just what it shows"
            : archetype.key === "romance"
              ? "That intimacy and distance are visible in how bodies and space are arranged on screen"
              : archetype.key === "sciFi"
                ? "That ideas and power structures can be embodied in the look and design of a world"
                : archetype.key === "crime"
                  ? "That moral ambiguity is visible in lighting, framing, and whose perspective we share"
                  : "That how a film looks is inseparable from what it is trying to say",
      correctFeedback: `You identified the connection between visual style and meaning in ${filmA}.`,
      partialFeedback: "Think about what the film's look communicates — not just how it feels, but what it argues.",
      incorrectFeedback: "Consider what the director's visual choices are doing to your understanding of the story, not just your emotions.",
    },
    // Q2 — Warm-Up, multiple choice: symbolism or technique in filmA
    {
      id: "q2",
      questionType: "multiple_choice",
      prompt: `In ${filmA}, what do recurring visual or sound elements most likely represent?`,
      focus: "Warm-Up",
      hint: "Think about something you noticed more than once — a color, object, sound, or kind of shot. What does the film keep returning to?",
      explanation: "Recurring elements are deliberate — directors use repetition to build meaning across a film.",
      options:
        archetype.key === "horror"
          ? [
              "Psychological states — fear, control, and the collapse of safety",
              "The production schedule and budget constraints of the shoot",
              "The director's personal nostalgia for a specific era",
              "Generic atmosphere with no specific thematic intent",
            ]
          : archetype.key === "romance"
            ? [
                "The emotional distance or closeness between characters",
                "The film's country of production and local customs",
                "Generic visual flair with no connection to the story",
                "The era in which the film was made rather than its themes",
              ]
            : archetype.key === "sciFi"
              ? [
                  "Power, surveillance, or what society gains and loses through technology",
                  "The technical difficulty of producing the film's visual effects",
                  "Pure spectacle disconnected from the film's ideas",
                  "The director's biography rather than the story's themes",
                ]
              : archetype.key === "crime"
                ? [
                    "Who holds power and how guilt and innocence are assigned",
                    "The logistical details of how crimes are planned",
                    "Background texture with no deeper significance",
                    "Stylistic trends from the decade the film was made",
                  ]
                : [
                    "The film's central thematic concerns — what it keeps returning to",
                    "Random visual choices made during production",
                    "Purely technical demonstrations of the cinematographer's skill",
                    "Nostalgia for a specific period rather than a thematic idea",
                  ],
      correctAnswer:
        archetype.key === "horror"
          ? "Psychological states — fear, control, and the collapse of safety"
          : archetype.key === "romance"
            ? "The emotional distance or closeness between characters"
            : archetype.key === "sciFi"
              ? "Power, surveillance, or what society gains and loses through technology"
              : archetype.key === "crime"
                ? "Who holds power and how guilt and innocence are assigned"
                : "The film's central thematic concerns — what it keeps returning to",
      correctFeedback: `You connected the film's visual pattern to its thematic argument.`,
      partialFeedback: "You're close — now say what that element is pointing at, not just what it looks or sounds like.",
      incorrectFeedback: `Think about what ${filmA} keeps returning to visually or sonically, and what that repetition is building toward.`,
    },
    // Q3 — Interpretation: theme + evidence in filmB
    {
      id: "q3",
      questionType: "short_answer",
      prompt: `What do you think ${filmB} is saying about power, belonging, or identity? Name one specific moment that shows it.`,
      focus: "Interpretation",
      hint: "Pick one of those ideas — power, belonging, or identity — and name one scene or character moment where the film makes a point about it.",
      explanation: "Naming what a film argues, with a scene to back it, is the foundation of film analysis.",
      maxWords: 18,
      placeholder: "The film argues that belonging is earned through sacrifice — the ending scene shows this.",
      acceptableAnswers: [
        "power", "belonging", "identity", "family", "memory",
        "loss", "freedom", "isolation", "connection", "control",
      ],
      acceptableKeywords: [
        "says", "argues", "shows", "suggests", "reveals",
        "character", "scene", "moment", "because", "when",
      ],
      correctFeedback: "You named what the film is arguing and anchored it in a specific moment.",
      partialFeedback: "You named the idea — now say one specific scene or character moment where the film makes that point.",
      incorrectFeedback: "Pick one theme word (power, belonging, identity) and name one scene where the film does something with it.",
      scaffoldSteps: [
        {
          prompt: `What is one big idea ${filmB} keeps returning to? Just name it — one word or short phrase.`,
          hint: "Try one of these: power, belonging, identity, memory, loss, freedom.",
          expectedFocus: "identifies a named theme",
        },
        {
          prompt: `Good. Now name one specific scene or character in ${filmB} where that idea shows up.`,
          hint: "Think about a moment that stood out — who is in it, what do they do or say.",
          expectedFocus: "grounds theme in a concrete scene or character",
        },
      ],
      fallbackMultipleChoice: {
        prompt: `Which of these best describes something ${filmB} seems to be about?`,
        options: ["Power, belonging, or identity", "Outer space and technology", "Medieval history"],
        correctAnswer: "Power, belonging, or identity",
        explanation: "Most character-driven films return to one of these — they are the territory where personal and social conflicts meet.",
      },
      revealAnswerAfterFallback: true,
    },
    // Q4 — Interpretation: scene meaning in filmB
    {
      id: "q4",
      questionType: "short_answer",
      prompt: `Pick one specific scene or moment in ${filmB}. What does it reveal about a character or the film's central idea?`,
      focus: "Interpretation",
      hint: `Name the scene first — who is in it, what happens. Then say what it reveals about the character or the film's argument.`,
      explanation: "Connecting a specific moment to what the film is arguing is the core move in film analysis.",
      maxWords: 18,
      placeholder: "When the protagonist refuses to leave, it shows that belonging matters more to them than safety.",
      acceptableAnswers: [
        "reveals", "shows", "character", "theme", "moment",
        "scene", "meaning", "because", "when", "how",
      ],
      acceptableKeywords: [
        "shows", "reveals", "tells", "character", "theme",
        "moment", "scene", "because", "when", "how",
      ],
      correctFeedback: "You connected a specific scene to what the film is saying.",
      partialFeedback: "You named a moment — now say what it reveals about the character or the theme.",
      incorrectFeedback: "Pick one scene and say what it means — not just what happens, but what the film is doing through it.",
      scaffoldSteps: [
        {
          prompt: `Name one specific scene or moment in ${filmB}. Just describe what happens.`,
          hint: "Don't analyze yet — just name the scene: who is in it, what do they do.",
          expectedFocus: "identifies a concrete scene",
        },
        {
          prompt: `What does that scene reveal about a character or the film's central idea?`,
          hint: "Ask: why did the director include this moment? What does it make you understand about the character or story?",
          expectedFocus: "interprets scene as meaningful, not just descriptive",
        },
      ],
      fallbackMultipleChoice: {
        prompt: `Which of these best describes what a scene in ${filmB} might reveal?`,
        options: [
          "A character's defining motivation or a theme the film keeps returning to",
          "The film's production budget",
          "The director's personal biography",
        ],
        correctAnswer: "A character's defining motivation or a theme the film keeps returning to",
        explanation: "Directors choose to linger on certain scenes because they carry weight — they reveal character or push the film's central idea forward.",
      },
      revealAnswerAfterFallback: true,
    },
    // Q5 — Compare: filmA vs filmB on shared concept
    {
      id: "q5",
      questionType: "short_answer",
      prompt: `Both ${filmA} and ${filmB} explore ${concept.toLowerCase()}. How does each film approach it differently? Name one specific moment from either film.`,
      focus: "Compare",
      hint: `Think about one scene in ${filmA} and one in ${filmB}. What does each film do differently with ${concept.toLowerCase()}?`,
      explanation: `Comparing how two films handle the same concept shows you how style, tone, and context shape meaning.`,
      maxWords: 20,
      placeholder: `${filmA} shows ${concept.toLowerCase()} through isolation, while ${filmB} does it through conflict.`,
      acceptableAnswers: [
        "different", "while", "whereas", "compared", "contrast",
        "one", "another", "both", "but", "unlike",
      ],
      acceptableKeywords: [
        "different", "while", "whereas", "compared", "contrast",
        "scene", "moment", "shows", "through", "both",
      ],
      correctFeedback: `You identified how ${filmA} and ${filmB} handle ${concept.toLowerCase()} differently — that's the compare move.`,
      partialFeedback: "You described one film — now say something about the other so you're actually comparing.",
      incorrectFeedback: `Name one thing each film does with ${concept.toLowerCase()} — they don't have to be opposites, just different.`,
      scaffoldSteps: [
        {
          prompt: `Think about ${filmA}. Name one moment or scene where ${concept.toLowerCase()} shows up.`,
          hint: `Just name the moment — who is in it, what happens. Don't worry about ${filmB} yet.`,
          expectedFocus: "locates a concrete moment in Film A",
        },
        {
          prompt: `Good. Now think about ${filmB}. Does it handle ${concept.toLowerCase()} in a similar or different way? Name one moment.`,
          hint: `Name a scene from ${filmB} and say what it does differently from what you described in ${filmA}.`,
          expectedFocus: "identifies a contrast or parallel with Film B",
        },
      ],
    },
    // Q6 — Compare: filmA vs filmC on shared concept
    {
      id: "q6",
      questionType: "short_answer",
      prompt: `Both ${filmA} and ${filmC} use visual style to communicate their themes. Which film does it more effectively, in your view? Name one moment from each.`,
      focus: "Compare",
      hint: `Think about a specific scene in ${filmA} and a specific scene in ${filmC}. What does each one do visually that makes the theme clear?`,
      explanation: "Comparing visual strategies across films trains you to see technique as a series of deliberate choices, not just style.",
      maxWords: 20,
      placeholder: `${filmA} uses framing to isolate characters, while ${filmC} uses color to signal emotional states.`,
      acceptableAnswers: [
        "visually", "style", "framing", "color", "lighting",
        "shot", "scene", "technique", "moment", "effective",
      ],
      acceptableKeywords: [
        "visual", "style", "while", "whereas", "scene",
        "moment", "technique", "shows", "through", "both",
      ],
      correctFeedback: `You compared the visual strategies of ${filmA} and ${filmC} — that's close reading across films.`,
      partialFeedback: "You named a technique in one film — now say something about the other so you're comparing.",
      incorrectFeedback: `Name one visual choice in ${filmA} and one in ${filmC} — then say what makes each effective or not.`,
      scaffoldSteps: [
        {
          prompt: `Name one visual technique you notice in ${filmA} — just name it: framing, color, lighting, slow motion.`,
          hint: "Pick something concrete you can see on screen in that film.",
          expectedFocus: "names a specific visual technique in Film A",
        },
        {
          prompt: `Good. Does ${filmC} use a similar technique, or a different one? Name what it does and say what changes.`,
          hint: `Look for a scene in ${filmC} that uses a similar or contrasting visual choice. Name the scene briefly.`,
          expectedFocus: "identifies a visual parallel or contrast in Film C",
        },
      ],
    },
    // Q7 — Transfer VERIFY (multiple choice) — placeholder, overwritten by buildFallbackQuiz with TransferSequence
    {
      id: "q7",
      questionType: "multiple_choice",
      prompt: `Which of these in ${filmA} is an example of using framing to create emotional focus?`,
      focus: "Transfer",
      hint: "Think about a moment where the camera placement directed what you noticed or felt.",
      explanation: "Recognizing a specific technique in context shows you can read film, not just name ideas.",
      options: [
        "A tight close-up on a character's face during a moment of fear",
        "A wide establishing shot introducing a new location",
        "A cut to the next scene before the moment resolves",
        "Background music swelling during a speech",
      ],
      correctAnswer: "A tight close-up on a character's face during a moment of fear",
      correctFeedback: "You recognized framing being used to shape emotional experience — the concept in action.",
      partialFeedback: "Focus on what the framing does to your attention, not just what it shows.",
      incorrectFeedback: "Think about what tight framing does to the viewer's focus and feeling.",
    },
    // Q8 — Transfer APPLY (short answer) — placeholder, overwritten by buildFallbackQuiz with TransferSequence
    {
      id: "q8",
      questionType: "short_answer",
      prompt: `Now find the same concept in ${filmB} — describe one specific moment or technique in one sentence.`,
      focus: "Transfer",
      hint: "Use the same lens as the teach block above, but apply it to a different film.",
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
      correctFeedback: "You applied the concept to a new film. That's the transfer.",
      partialFeedback: `You described a moment — name the specific technique or craft choice that makes it work in ${filmB}.`,
      incorrectFeedback: `Pick one specific moment in ${filmB} and say what technique is used and what it shows.`,
      scaffoldSteps: [
        {
          prompt: `Think about ${filmB}. Is there a scene that felt important or stood out? Just describe it briefly.`,
          hint: "Don't worry about technique yet — just name the scene. Who is in it, what happens.",
          expectedFocus: "locates a concrete scene in Film B",
        },
        {
          prompt: `What technique does the director use in that scene, and what does it show?`,
          hint: "Look for: close-up, framing, silence, color, editing pace. Then say what the director is communicating.",
          expectedFocus: "connects technique to meaning in Film B",
        },
      ],
      fallbackMultipleChoice: {
        prompt: `Which of these best describes a moment of ${concept.toLowerCase()} in ${filmB}?`,
        options: [
          "A scene where a character relationship is tested or shaped",
          "A scene where a character learns something from a newspaper",
          "The opening credits sequence",
        ],
        correctAnswer: "A scene where a character relationship is tested or shaped",
        explanation: `${concept} shows up whenever characters actively affect each other — that's the moment to find.`,
      },
      revealAnswerAfterFallback: false,
    },
    // Q9 — Reflection (no fallbackMultipleChoice, no revealAnswerAfterFallback)
    {
      id: "q9",
      questionType: "short_answer",
      prompt: "Which moment in any of your Top 4 films affected you the most? How did the film create that impact?",
      focus: "Reflection",
      hint: "Think about a specific scene that stayed with you. What did the film do — visually, through sound, or through the story — to make it land?",
      explanation: "Reflection questions have no wrong answers — the goal is to connect your experience to how the film was made.",
      maxWords: 25,
      placeholder: "The ending of [film] stayed with me because the silence made the loss feel real.",
      acceptableAnswers: ["moment", "scene", "because", "felt", "when", "affected", "impact"],
      acceptableKeywords: ["moment", "scene", "impact", "felt", "film", "when", "because", "stayed"],
      correctFeedback: "That kind of specific, personal observation — grounded in how the film was made — is exactly what film literacy looks like.",
      partialFeedback: "You named a moment — now say what the film did to create that impact.",
      incorrectFeedback: "Think about one specific scene and say why it stayed with you.",
      scaffoldSteps: [
        {
          prompt: "Just name one film or scene that stayed with you after watching — don't analyze yet.",
          hint: "It doesn't need to be the 'best' moment. Just name the one that comes to mind.",
          expectedFocus: "identifies a specific moment or film",
        },
        {
          prompt: "What did the film do to create that impact — what technique, choice, or element?",
          hint: "Think about lighting, music, silence, framing, performance, or how the story ended.",
          expectedFocus: "connects impact to a specific cinematic choice",
        },
      ],
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
    verifyQuestionId: "q7",
    applyQuestionId: "q8",
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

  // Overwrite Q7 (verify MC) and Q8 (apply SA) with TransferSequence-specific content
  const questions: QuizQuestion[] = enriched.map((q) => {
    if (q.id === "q7") {
      // Build four plausible scene descriptions — correct answer paraphrases, never copies, the teachStatement.
      const correctOption = `A scene in ${filmA} where a character relationship directly shapes the outcome`;
      return {
        id: "q7",
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

    if (q.id === "q8") {
      const applyKeywords = _applyKeywords.length > 0
        ? _applyKeywords
        : ["framing", "silence", "color", "sound", "close-up", "family", "moment"];
      return {
        id: "q8",
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
      "Nine prompts across five sections: warm up, interpretation, compare, transfer, and reflection. Keep each short answer to one or two sentences.",
    transferConcept: cleanTransfer,
    questions,
  };
}
