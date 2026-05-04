Current Stack
Next.js on Render with OpenAI's API. This is appropriate for a prototype but would not scale well for a production deployment.

Hosting Architecture
The plan is to move to AWS, specifically using AWS Bedrock to host the model inference layer. Bedrock gives access to a range of foundation models with AWS-native IAM controls, VPC support, and data retention policies that are easier to negotiate institutionally than consumer OpenAI terms.
The Next.js frontend would move to an AWS Amplify deployment or a containerized setup behind a CloudFront distribution. The Wikipedia API calls are stateless and inexpensive, so they stay as-is.

Model Choice at Scale
GPT-4o-mini is the right model for the current price point. At scale, AWS Bedrock's access to Claude Haiku or Meta's Llama models at lower price points would be worth evaluating.
Any model switch would require re-running the full prompt optimization process. The current prompts were tuned specifically for GPT-4o-mini's response style and JSON schema enforcement. Different models respond differently to the same prompt language, and the quiz schema validation would need to be re-implemented using each model's equivalent of OpenAI's structured outputs parameter.

Data Privacy
The current implementation sends the text of every quiz answer to OpenAI for evaluation. In a real educational deployment, especially one involving minors or an institutional context, this would need to be addressed.
Options:

Use a self-hosted model via AWS Bedrock with a private VPC
Opt into OpenAI's zero-data-retention API tier
Anonymize payloads before sending (strip identifying information)

Wikipedia context fetching should be cached to reduce API calls and avoid rate limiting. Session data should expire automatically and never touch a persistent database unless a user explicitly opts in.

Cost Model
Per session breakdown
ActionCountEstimated costWikipedia fetches4 (one per film)Negligible (free API)Lesson or quiz generation call1~$0.001Quiz evaluation calls~9 (full quiz)~$0.005 totalTotal per session~$0.006
At scale
Daily Active UsersMonthly sessions (est.)Monthly API cost (est.)100 DAU~3,000 sessions~$181,000 DAU~30,000 sessions~$180
These estimates assume GPT-4o-mini pricing at $0.15/1M input tokens and $0.60/1M output tokens, and an average of 10 evaluation calls per session. The fallback system ensures users still get an experience during API outages without paying for inference.
The bigger cost driver at scale is compute for the Next.js server, which scales with session concurrency, not just volume.

Failure Modes
FailureCurrent handlingProduction recommendationWikipedia fetch fails for one or more filmsPer-film try/catch returns null; generation continues without that contextAdd caching layer; monitor coverage gaps for non-mainstream filmsOpenAI call returns malformed JSONFallback generator produces templated contentAdd structured output retry with exponential backoffLetterboxd scrape fails (HTML structure change)Manual entry path available as fallbackReplace scraping with official Letterboxd API integration when available; treat manual entry as primary pathOpenAI API rate limit hitReturns fallback content with user-facing messageImplement request queuing and user-facing wait stateMissing API keyFalls back to deterministic fallback generatorSeparate fallback telemetry so ops team is alerted