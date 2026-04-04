
## Phase 16 — Global Signal Intelligence Engine

### Step 1: Database Schema
Create `global_signals` table with full canonical schema (id, title, summary, category, status, confidence/impact/urgency scores, affected regions/sectors, source references, recommended actions, decision candidates, routing targets, evidence hash, audit fields).

### Step 2: Edge Function — Signal Ingestion + AI Classification
Build `ingest-global-signals` edge function that:
- Pulls from NewsAPI (already have NEWSAPI_KEY)
- Normalizes and deduplicates events
- Uses Lovable AI (Gemini Flash) for classification, impact scoring, and decision recommendation generation
- Writes structured signals to `global_signals` table
- Routes high-impact signals to `decision_outcome_log` as decision candidates
- Logs all steps to audit trail

### Step 3: /live Route — AICIS Live Command Feed
Build premium institutional command feed UI with:
- Top signals panel (highest impact)
- Live signal feed with filters (category, region, sector)
- Signal detail drawer/panel
- Audience mode toggle (Government/Media/Business/Public)
- Alert ribbon for breaking/escalating signals
- Integration actions (create decision, add to brief, route to ops)

### Step 4: Morning Brief Integration
Add "Top Global Signals" section to Morning Brief showing top 5 signals with impact summaries and recommended actions.

### Step 5: Sidebar + Routing
Add /live route to App.tsx and sidebar navigation.

### Step 6: Cron Setup
Schedule hourly ingestion via pg_cron.
