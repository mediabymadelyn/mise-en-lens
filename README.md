# Mise-en-lens
A personalized AI system that helps users understand film through their Letterboxd-style Top 4, combining film theory with interactive, taste-based learning.

## Prerequisites

- Node.js >= 20.9.0 (recommended: install via [nvm](https://github.com/nvm-sh/nvm))
- npm

## Local setup

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Environment variables

Create a `.env.local` file in the project root:

```
OPENAI_API_KEY=sk-...
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No | — | OpenAI API key for AI-generated lessons and quizzes. Without it, the app falls back to a built-in lesson generator. |
| `OPENAI_FILM_TUTOR_MODEL` | No | `gpt-4o-mini` | Override the OpenAI model used for tutor generation. |
| `YOUTUBE_API_KEY` | No | — | YouTube Data API v3 key. When set, the quiz surfaces a recap video link when a student indicates they don't remember a film. Without it, the recap feature is silently disabled. |

### Getting a YouTube Data API key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable the **YouTube Data API v3** under APIs & Services → Library
4. Create an API key under APIs & Services → Credentials
5. Add it to your `.env` file as `YOUTUBE_API_KEY=your_key_here`

The free tier allows ~100 search requests per day (10,000 quota units; each search costs 100 units). The recap feature fires one search per memory-gap event, so this is sufficient for normal usage.

## Testing Wikipedia integration

The app fetches Wikipedia articles (intro, plot synopsis, and themes) for each film and uses them to ground lesson/quiz generation. You can test this independently without an OpenAI key or running the dev server:

```bash
npx tsx scripts/test-wikipedia.ts "The Matrix"
npx tsx scripts/test-wikipedia.ts "Spirited Away"
npx tsx scripts/test-wikipedia.ts "Moonlight"
```

This prints every field populated from Wikipedia, shows how each module uses the data, and demonstrates the before/after impact on quiz answer verification keywords.

See [architecture-diagrams/wikipedia-integration.md](architecture-diagrams/wikipedia-integration.md) for the full data flow diagram.
