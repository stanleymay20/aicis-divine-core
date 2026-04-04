import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "geopolitical","economic","financial_markets","central_banking",
  "public_health","climate_disaster","energy","technology",
  "cybersecurity","defense_conflict","legal_regulatory",
  "supply_chain","elections","social_unrest","infrastructure"
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  geopolitical: ["sanctions","diplomacy","treaty","summit","UN","NATO","ambassador","territorial","sovereignty"],
  economic: ["GDP","recession","inflation","unemployment","trade deficit","stimulus","fiscal"],
  financial_markets: ["stock","market","S&P","Nasdaq","Dow","bonds","rally","crash","IPO","SEC"],
  central_banking: ["Fed","ECB","interest rate","monetary policy","central bank","rate hike","rate cut","quantitative"],
  public_health: ["WHO","pandemic","outbreak","vaccine","epidemic","disease","health emergency","COVID","bird flu"],
  climate_disaster: ["earthquake","hurricane","flood","wildfire","tsunami","drought","climate","storm","tornado"],
  energy: ["oil","gas","OPEC","pipeline","renewable","solar","nuclear","energy crisis","power grid"],
  technology: ["AI","artificial intelligence","tech","semiconductor","chip","cyber","quantum","data breach"],
  cybersecurity: ["hack","ransomware","breach","malware","cyber attack","phishing","vulnerability","zero-day"],
  defense_conflict: ["military","war","troops","missile","bombing","ceasefire","invasion","defense","conflict"],
  legal_regulatory: ["regulation","lawsuit","court","ruling","law","antitrust","compliance","GDPR","ban"],
  supply_chain: ["supply chain","shipping","port","logistics","shortage","tariff","import","export","trade"],
  elections: ["election","vote","ballot","candidate","polling","referendum","inauguration","campaign"],
  social_unrest: ["protest","riot","demonstration","strike","unrest","civil","march","activist"],
  infrastructure: ["bridge","dam","grid","telecom","internet","rail","airport","infrastructure","blackout"],
};

function classifyCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  let best = "geopolitical";
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(k => text.includes(k.toLowerCase())).length;
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

function computeDedup(title: string, source: string): string {
  const normalized = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const words = normalized.split(' ').slice(0, 8).join(' ');
  return `${words}::${source}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const NEWSAPI_KEY = Deno.env.get("NEWSAPI_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!NEWSAPI_KEY) throw new Error("NEWSAPI_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Step 1: Fetch from NewsAPI - top headlines across categories
    const categories = ["general", "business", "health", "science", "technology"];
    const allArticles: any[] = [];

    for (const cat of categories) {
      try {
        const url = `https://newsapi.org/v2/top-headlines?category=${cat}&language=en&pageSize=10&apiKey=${NEWSAPI_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.articles) {
            allArticles.push(...data.articles.map((a: any) => ({ ...a, _newsCat: cat })));
          }
        }
      } catch (e) {
        console.error(`NewsAPI ${cat} error:`, e);
      }
    }

    console.log(`Fetched ${allArticles.length} raw articles`);

    // Step 2: Filter out junk
    const validArticles = allArticles.filter(a =>
      a.title && a.title !== "[Removed]" &&
      a.description && a.description !== "[Removed]" &&
      a.url
    );

    // Step 3: Deduplicate
    const seen = new Set<string>();
    const uniqueArticles = validArticles.filter(a => {
      const key = computeDedup(a.title, a.source?.name || "unknown");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Check existing dedup keys
    const dedupKeys = uniqueArticles.map(a => computeDedup(a.title, a.source?.name || "unknown"));
    const { data: existing } = await supabase
      .from("global_signals")
      .select("dedup_key")
      .in("dedup_key", dedupKeys);
    const existingKeys = new Set((existing || []).map((r: any) => r.dedup_key));
    const newArticles = uniqueArticles.filter(a => {
      const key = computeDedup(a.title, a.source?.name || "unknown");
      return !existingKeys.has(key);
    });

    console.log(`${newArticles.length} new unique articles after dedup`);

    if (newArticles.length === 0) {
      return new Response(JSON.stringify({ ok: true, new_signals: 0, message: "No new signals" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: AI classification batch - process top 15 most relevant
    const topArticles = newArticles.slice(0, 15);
    const articlesSummary = topArticles.map((a, i) =>
      `[${i}] "${a.title}" — ${a.description || "No description"} (Source: ${a.source?.name || "Unknown"})`
    ).join("\n");

    const classifyStart = Date.now();
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are AICIS, a global intelligence classification engine. For each news article, produce a JSON array of objects. Each object must have:
- index: article index number
- category: one of ${CATEGORIES.join(", ")}
- confidence_score: 0-100 how confident you are in category classification
- impact_score: 0-100 estimated global significance (80+ = major world event, 60-79 = significant, 40-59 = moderate, below 40 = minor)
- urgency_score: 0-100 how time-sensitive this is
- affected_regions: array of region names
- affected_countries: array of ISO3 country codes
- affected_sectors: array of sectors affected
- strategic_implications: one sentence on why this matters strategically
- likely_consequences: one sentence on probable outcomes
- recommended_actions: object with keys "government", "media", "business", "public" each being a short recommended action
- misinformation_risk: 0-100

Only return the JSON array, no markdown.`
          },
          {
            role: "user",
            content: `Classify these articles:\n${articlesSummary}`
          }
        ],
      }),
    });

    let classifications: any[] = [];
    const classificationTimeMs = Date.now() - classifyStart;

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        classifications = JSON.parse(cleaned);
      } catch (e) {
        console.error("AI parse error:", e, "Content:", content.slice(0, 500));
      }
    } else {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
    }

    // Step 5: Build signal objects
    const signals: any[] = [];
    for (let i = 0; i < topArticles.length; i++) {
      const article = topArticles[i];
      const cls = classifications.find((c: any) => c.index === i) || {};

      const category = CATEGORIES.includes(cls.category) ? cls.category : classifyCategory(article.title, article.description || "");
      const dedupKey = computeDedup(article.title, article.source?.name || "unknown");

      // Evidence hash
      const encoder = new TextEncoder();
      const hashData = encoder.encode(`${article.title}|${article.url}|${article.publishedAt}`);
      const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
      const evidenceHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      signals.push({
        title: article.title,
        summary: article.description || article.title,
        normalized_summary: cls.strategic_implications || article.description || article.title,
        category,
        status: "new",
        confidence_score: Math.min(100, Math.max(0, cls.confidence_score || 50)),
        impact_score: Math.min(100, Math.max(0, cls.impact_score || 40)),
        urgency_score: Math.min(100, Math.max(0, cls.urgency_score || 40)),
        source_count: 1,
        primary_source: article.source?.name || "Unknown",
        source_references: [{ url: article.url, name: article.source?.name, published: article.publishedAt }],
        first_detected_at: article.publishedAt || new Date().toISOString(),
        latest_update_at: new Date().toISOString(),
        occurred_at: article.publishedAt || null,
        affected_regions: cls.affected_regions || [],
        affected_countries: cls.affected_countries || [],
        affected_sectors: cls.affected_sectors || [],
        affected_stakeholders: [],
        strategic_implications: cls.strategic_implications || null,
        likely_consequences: cls.likely_consequences || null,
        misinformation_risk: cls.misinformation_risk || 0,
        recommended_actions: cls.recommended_actions || {},
        audience_framing: cls.recommended_actions || {},
        impact_reasoning: cls.strategic_implications || null,
        evidence_hash: evidenceHash,
        model_version: "gemini-3-flash-preview",
        classification_time_ms: classificationTimeMs,
        ingestion_source: "newsapi",
        dedup_key: dedupKey,
      });
    }

    // Step 6: Insert signals
    const { data: inserted, error: insertErr } = await supabase
      .from("global_signals")
      .insert(signals)
      .select("id, title, impact_score, category");

    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error(`Insert failed: ${insertErr.message}`);
    }

    console.log(`Inserted ${inserted?.length || 0} signals`);

    // Step 7: Route high-impact signals to decision_outcome_log
    const highImpact = (inserted || []).filter((s: any) => s.impact_score >= 70);
    let decisionsCreated = 0;

    for (const signal of highImpact) {
      const cls = classifications.find((c: any) => {
        const article = topArticles[c.index];
        return article?.title === signal.title;
      });

      await supabase.from("decision_outcome_log").insert({
        decision_title: `[SIGNAL] ${signal.title}`,
        domain: signal.category === "public_health" ? "health" :
                signal.category === "defense_conflict" ? "security" :
                signal.category === "economic" || signal.category === "financial_markets" ? "economy" :
                signal.category === "energy" ? "energy" :
                signal.category === "climate_disaster" ? "food" :
                "governance",
        action_taken: false,
        signal_source: "global_signal_engine",
        signal_id: signal.id,
        evidence_type: "hypothetical",
        acceptance_status: "pending",
      });
      decisionsCreated++;
    }

    // Step 8: Audit log
    await supabase.from("audit_log").insert({
      action: "global_signal_ingestion",
      resource_type: "global_signals",
      severity: "info",
      metadata: {
        articles_fetched: allArticles.length,
        unique_after_dedup: newArticles.length,
        signals_created: inserted?.length || 0,
        decisions_routed: decisionsCreated,
        classification_time_ms: classificationTimeMs,
        model: "gemini-3-flash-preview",
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      new_signals: inserted?.length || 0,
      high_impact_routed: decisionsCreated,
      classification_time_ms: classificationTimeMs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Ingestion error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
