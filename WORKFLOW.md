# Replaceable.ai Command Centre — Complete Workflow Guide

## What Is This Tool?

**Replaceable.ai Command Centre** is an AI-powered intelligence dashboard that:
- Scans the web for the latest **AI layoff / job automation news** globally
- Converts any news signal into a **full professional article** (download-ready HTML)
- Generates **LinkedIn posts** in one click
- Finds **HR decision-maker contacts** for outreach via Clay

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   VERCEL (Live Website)              │
│                                                     │
│   ┌──────────────┐        ┌──────────────────────┐  │
│   │   Frontend   │───────▶│   Backend API        │  │
│   │  (React App) │        │   /api/ai.js         │  │
│   │              │        │   /api/clay.js       │  │
│   └──────────────┘        └──────────┬───────────┘  │
│                                      │              │
└──────────────────────────────────────┼──────────────┘
                                       ▼
                          ┌─────────────────────────┐
                          │   Anthropic Claude API  │
                          │   (AI brain — secure)   │
                          └─────────────────────────┘
```

**Project file structure:**
```
command-centre/
├── api/
│   ├── ai.js              ← Secure Anthropic API proxy
│   └── clay.js            ← Secure Clay contacts proxy
├── src/
│   ├── App.jsx            ← Full React application
│   └── supabaseClient.js  ← Database connection
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── WORKFLOW.md            ← This file
```

---

## Daily Workflow (10 minutes every morning)

```
1. Open the live website
         ↓
2. Click "Run Daily Scan"
         ↓
3. AI runs 8 search queries (30–60 seconds)
         ↓
4. 5–7 signal cards appear (Tier 1, 2, 3)
         ↓
5. Click on the most relevant signal
         ↓
6. Click "Generate Article" or "LinkedIn Post"
         ↓
7. Edit → Preview → Download / Copy
```

---

## Feature 1 — Daily News Scan

**What it does:** AI searches the web using 8 pre-set queries:
1. "AI layoffs" + current month/year
2. "AI job cuts" 2026
3. "AI replacing workers" OR "automation job losses"
4. "AI hiring freeze" OR "AI headcount reduction"
5. CEO AI workforce statements
6. Google, Amazon, Microsoft, Meta AI restructuring news
7. Humanoid robot / physical AI deployment news
8. "AI agents replacing" workforce stories

**Output:** 5–7 signal cards, each containing:
- **Tier** — 1 (Critical), 2 (Significant), 3 (Monitor)
- **Title** — News headline
- **Summary** — 3–4 sentence brief with numbers and sources
- **RPI Score** — 1–10 (relevance to workforce automation)
- **Geography** — Where the news is from
- **Companies** — Organisations involved
- **Affected Roles** — Which job categories are impacted

---

## Feature 2 — Topic / Industry Scan

**When to use:** When you need signals on a specific sector or topic.

**How:** Type a query in the search box → Click Scan
```
Examples:
  "healthcare AI India"
  "fintech layoffs 2026"
  "manufacturing automation Germany"
  "legal AI UK"
```

---

## Feature 3 — Article Generator (3-Phase Pipeline)

Select a signal → Click **"Generate Article"**

### Phase 1 — Deep Research (Web Search ON) — ~30–60 sec
AI searches the internet for:
- Real numbers, stats, dollar amounts, headcount figures
- Direct executive quotes with attribution
- Event timeline
- Peer company comparisons
- Analyst/expert commentary

### Phase 2 — Editorial Writing — ~20–30 sec
Writes a 700–900 word article in the style of *The Economist* meets *Bloomberg Intelligence*:
- Every paragraph anchored by a concrete data point
- Named sources, not generic commentary
- Executive blockquote with attribution
- CHRO-focused strategic angle
- Closing hook to the paid intelligence layer

### Phase 3 — Paid Intelligence Layer (RPI JSON) — ~20–30 sec
Generates structured subscriber content:
- **Role-by-role RPI scores** (0–100 automation exposure)
- **Task-level breakdown** (which specific tasks are at risk)
- **Sector exposure map** (4–6 sectors affected)
- **CHRO Action Brief** (5 concrete steps to take this week)

**Total time: ~2–3 minutes per article**

**Output:** Click "Download Final" → clean `.html` file, ready to publish.

---

## Feature 4 — LinkedIn Post Generator

Select a signal → Click **"LinkedIn Post"**

**Voice:** Aman Sehgal, Founder of Replaceable.ai
**Format:**
- 250–400 words
- Data-led, sharp, provocative
- Bullet points using →
- 3–4 relevant hashtags
- Call-to-action to daily brief
- 🔴 emoji at start only

**Generation time:** ~10 seconds

---

## Feature 5 — Clay Contact Targeting

Select a signal → Click **"Find Targets (Clay)"**

**What it does:** Uses Clay MCP to find 5–10 senior contacts at affected companies:
- CHRO
- VP HR
- Head of Workforce Planning
- VP Operations

Then generates a **personalised 120-word LinkedIn outreach message** for each contact — intelligence-led, not sales-driven.

---

## Feature 6 — Archive

Click **"Archive"** in the header → Browse signals by past date.

- **With Supabase:** Signals persist permanently in the cloud database.
- **Without Supabase:** Signals are stored in browser localStorage (device only).

---

## One-Time Account Setup

| Service | Purpose | Cost |
|---------|---------|------|
| **GitHub** | Code version control | Free |
| **Vercel** | Website hosting + serverless API | Free tier |
| **Anthropic API** | AI brain (Claude Sonnet) | ~$0.10–0.20 per scan |
| **Supabase** | Signal database | Free (500MB) |

---

## Environment Variables (Set in Vercel Dashboard)

```
ANTHROPIC_API_KEY       = sk-ant-api03-...          (Required)
VITE_SUPABASE_URL       = https://xxx.supabase.co   (Optional)
VITE_SUPABASE_ANON_KEY  = eyJ...                    (Optional)
```

Go to: Vercel → Project → Settings → Environment Variables → Add → Redeploy

---

## Updating the App (When You Change Code)

```bash
# Make changes to any file locally, then:
git add .
git commit -m "describe your change"
git push

# Vercel automatically redeploys within 1–2 minutes
```

---

## Estimated Monthly Cost

| Usage | Estimated Cost |
|-------|---------------|
| 1 Daily Scan | ~$0.15 |
| 1 Article Generated | ~$0.30–$0.50 |
| 30 scans/month | ~$4–5 |
| 30 articles/month | ~$10–15 |
| **Total** | **~$15–20/month** |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Scan fails immediately | Check `ANTHROPIC_API_KEY` is set in Vercel env vars |
| No signals returned | Check API credits at console.anthropic.com |
| Deploy failed | Vercel → Deployments → click failed build → read logs |
| Signals lost on refresh | Set up Supabase, or they are in localStorage only |
| Article times out | Retry — web search can be slow; 120s timeout is set |

--- file 

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Inline CSS (no external framework) |
| Backend | Vercel Serverless Functions (Node.js) |
| AI Model | Claude Sonnet 4 (Anthropic) |
| Database | Supabase (PostgreSQL) — optional |
| Hosting | Vercel |
| Version Control | GitHub |
