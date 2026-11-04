# Solo Leveling System: deploy to Vercel

```
solo-leveling/
  public/index.html    the app (static)
  api/advisor.js       chat + intent detection + goal extraction
  api/plan.js          planner: 12-week phases, PR metric, adaptive targets
  api/_llm.js          shared helper: free-model chain, optional Anthropic fallback
  vercel.json          output folder + function timeout
  .env.example         the one secret you need
```

## 1. Get a free API key
Create a key at https://openrouter.ai/keys (no card needed for `:free` models).
Free models are rate-limited, and OpenRouter may return 402 errors under heavy use until you add a few dollars of credit.
Optional paid fallback: an Anthropic key (`ANTHROPIC_API_KEY`), used only if every free model fails.

## 2. Test locally (optional)
```
npm i -g vercel
cp .env.example .env.local     # paste your OpenRouter key
vercel dev                     # http://localhost:3000
```

## 3. Deploy: pick one

### A. GitHub + Vercel dashboard (recommended, auto-redeploys on push)
1. `git init && git add . && git commit -m "init"`, create a GitHub repo, push.
2. vercel.com > Add New > Project > import the repo.
3. Framework Preset: **Other**. Leave Build Command empty. Output Directory comes from vercel.json.
4. Settings > Environment Variables > add `OPENROUTER_API_KEY` (Production, Preview, Development).
5. Deploy. Open the URL.

### B. Vercel CLI
```
vercel login
vercel                          # first deploy, accept the defaults
vercel env add OPENROUTER_API_KEY
vercel --prod
```
Add the env var, then redeploy. Env vars only apply to new deployments.

## 4. Verify
Open the Advisor tab and send "hey, how am I doing?". A normal reply means the server works.
If you see "Local analysis mode: server unreachable" under replies, the function is failing:
- 503: no API key set, or you did not redeploy after adding it.
- 502: every free model failed (rate limit, retired slug, or bad key). Check Vercel > Logs.
- Works on localhost but not on Vercel: the key was added to the wrong environment.

## Choosing models
Free model slugs change often. Browse https://openrouter.ai/models (filter: free), then set in Vercel:
- `CHAT_MODELS`: fast model for conversation and intent detection
- `PLAN_MODELS`: a reasoning ("thinking") model for planning
Both take a comma-separated fallback list, tried in order. The default is `openai/gpt-oss-120b:free,openrouter/free`.

## Personal records (PR) and adaptive targets
- Log a result under Quests > Personal Records. The first log sets a baseline; beating it is a PR (bonus EXP, +1 stat).
- Daily targets: the larger of level scaling or 80% of your PR. Three missed days in a row cuts it 20% (DELOAD); a 5-day streak raises it 10% (OVERLOAD).
- Goal metrics get a next target 5% past your best; the planner model refines it when reachable.

## Notes
- Your progress lives in each browser's localStorage. A different phone or browser starts fresh.
- Anyone with your URL can call `/api/advisor` on your key. The function caps message size and rate-limits per IP (best effort). Free models cost nothing, but if you add the Anthropic fallback, set a spend limit there.
- The app uses the Tailwind CDN script, which is fine for personal use.
