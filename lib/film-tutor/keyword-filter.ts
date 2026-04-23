// Generic words that appear in virtually any film discussion and make acceptableKeywords
// useless as off-topic signals. Strip these before storing or using keyword lists.
const KEYWORD_STOPLIST = new Set([
  // Generic verbs
  "shows", "reveals", "suggests", "says", "argues", "tells", "creates", "uses", "makes",
  // Overly vague scene markers
  "moment", "scene",
  // Common discourse connectors
  "because", "when", "how", "while",
  "and", "but", "or", "both", "through",
]);

export function filterAcceptableKeywords(keywords: string[]): string[] {
  return keywords.filter((k) => !KEYWORD_STOPLIST.has(k.toLowerCase().trim()));
}
