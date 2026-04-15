#!/usr/bin/env npx tsx
/**
 * CLI tool to test Wikipedia integration for a given film title.
 *
 * Usage:
 *   npx tsx scripts/test-wikipedia.ts "The Matrix"
 *   npx tsx scripts/test-wikipedia.ts "Spirited Away"
 */

import { fetchWikiContextForFilms } from "../lib/wikipedia/client";
import type { WikiFilmContext } from "../lib/wikipedia/client";

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

function extractWikiKeywords(text: string): string[] {
  const words = text.split(/[\s,;:.!?()\[\]"]+/).filter(Boolean);
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

function separator(label: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("=".repeat(60));
}

function wordCount(text: string | null): number {
  return text ? text.split(/\s+/).length : 0;
}

async function main() {
  const title = process.argv[2];
  if (!title) {
    console.error("Usage: npx tsx scripts/test-wikipedia.ts \"Film Title\"");
    process.exit(1);
  }

  console.log(`\nLooking up: "${title}"\n`);

  const contextMap = await fetchWikiContextForFilms([title]);
  const ctx = contextMap.get(title);

  if (!ctx) {
    console.error(`No Wikipedia article found for "${title}".`);
    process.exit(1);
  }

  // --- WikiFilmContext fields ---
  separator("WikiFilmContext (lib/wikipedia/client.ts)");
  console.log(`\n  filmTitle:    ${ctx.filmTitle}`);
  console.log(`  wikiTitle:    ${ctx.wikiTitle}`);
  console.log(`  description:  ${ctx.description ?? "(none)"}`);
  console.log(`  pageUrl:      ${ctx.pageUrl}`);

  console.log(`\n  extract (${wordCount(ctx.extract)} words):`);
  console.log(`  ${ctx.extract}\n`);

  console.log(`  plot (${wordCount(ctx.plot)} words):`);
  console.log(`  ${ctx.plot ?? "(not found)"}\n`);

  console.log(`  themes (${wordCount(ctx.themes)} words):`);
  console.log(`  ${ctx.themes ?? "(not found)"}`);

  // --- How openai.ts uses it ---
  separator("OpenAI prompt injection (lib/film-tutor/openai.ts)");
  const parts = [`Reference context for "${ctx.filmTitle}":\n${ctx.extract}`];
  if (ctx.plot) parts.push(`Plot synopsis:\n${ctx.plot}`);
  if (ctx.themes) parts.push(`Themes:\n${ctx.themes}`);
  const referenceBlock = parts.join("\n\n");

  console.log("\n  buildWikiReferenceBlock() produces:\n");
  console.log(`  ${referenceBlock.slice(0, 600)}${referenceBlock.length > 600 ? "\n  ... (truncated for display)" : ""}`);
  console.log(`\n  Total reference block: ${wordCount(referenceBlock)} words`);
  console.log("\n  This block is appended to both buildLessonPrompt() and buildQuizPrompt().");
  console.log("  Lesson prompt adds: \"Do not invent plot details, director names, release years,");
  console.log("  or cast information that is not supported by the reference context.\"");
  console.log("  Quiz prompt adds: \"Populate acceptableAnswers and acceptableKeywords using");
  console.log("  factual details from the reference context.\"");

  // --- How fallback.ts uses it ---
  separator("Fallback lesson enrichment (lib/film-tutor/fallback.ts)");
  let enrichedSummary: string;
  if (ctx.plot) {
    enrichedSummary = `${ctx.plot.split(". ").slice(0, 3).join(". ")}. This makes it a useful reference point for studying how film style shapes interpretation.`;
  } else {
    enrichedSummary = `${ctx.extract.split(". ").slice(0, 2).join(". ")}. This makes it a useful reference point for studying how film style shapes interpretation.`;
  }
  console.log("\n  buildFilmNote() replaces generic boilerplate with:\n");
  console.log(`  "${enrichedSummary.slice(0, 400)}${enrichedSummary.length > 400 ? "..." : ""}"`);

  // --- Extracted keywords for quiz enrichment ---
  separator("Fallback quiz keyword enrichment (lib/film-tutor/fallback.ts)");
  const extractKeywords = extractWikiKeywords(ctx.extract);
  const plotKeywords = ctx.plot ? extractWikiKeywords(ctx.plot) : [];
  const themeKeywords = ctx.themes ? extractWikiKeywords(ctx.themes) : [];
  const allKeywords = [...new Set([...extractKeywords, ...plotKeywords, ...themeKeywords])];

  console.log(`\n  From extract: ${extractKeywords.length} keywords`);
  console.log(`  From plot:    ${plotKeywords.length} keywords`);
  console.log(`  From themes:  ${themeKeywords.length} keywords`);
  console.log(`  Combined (deduplicated): ${allKeywords.length} keywords\n`);
  console.log(`  ${allKeywords.join(", ")}`);
  console.log("\n  enrichQuizKeywords() appends these to each short_answer question's");
  console.log("  acceptableAnswers and acceptableKeywords arrays.");

  // --- Show what a mock quiz question looks like before/after ---
  separator("Example: quiz answer verification impact");
  const baseAnswers = ["identity", "power", "family", "technology"];
  const baseKeywords = ["identity", "power", "explores", "shows"];

  const existingAnswers = new Set(baseAnswers);
  const existingKeywords = new Set(baseKeywords);
  const newAnswers = allKeywords.filter((kw) => !existingAnswers.has(kw)).slice(0, 2);
  const newKeywords = allKeywords.filter((kw) => !existingKeywords.has(kw)).slice(0, 6);

  console.log("\n  Before Wikipedia enrichment:");
  console.log(`    acceptableAnswers:  [${baseAnswers.join(", ")}]`);
  console.log(`    acceptableKeywords: [${baseKeywords.join(", ")}]`);
  console.log("\n  After Wikipedia enrichment:");
  console.log(`    acceptableAnswers:  [${[...baseAnswers, ...newAnswers].join(", ")}]`);
  console.log(`    acceptableKeywords: [${[...baseKeywords, ...newKeywords].join(", ")}]`);

  // --- Summary ---
  separator("Modules that consume WikiFilmContext");
  console.log(`
  1. lib/film-tutor/openai.ts
     - buildWikiReferenceBlock() injects extract + plot + themes into prompts
     - buildLessonPrompt() -> generateLessonWithOpenAI()
     - buildQuizPrompt()   -> generateQuizWithOpenAI()

  2. lib/film-tutor/fallback.ts
     - buildFallbackLesson() -> buildFilmNote() uses plot/extract for film note summaries
     - buildFallbackQuiz()   -> enrichQuizKeywords() appends wiki keywords from
       extract + plot + themes to quiz acceptableAnswers/acceptableKeywords

  3. app/api/tutor/route.ts
     - Calls fetchWikiContextForFilms() and passes the result to all of the above
`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
