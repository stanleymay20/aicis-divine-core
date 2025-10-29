import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Detect domain from query
    const domain = detectDomain(query);
    
    // Fetch relevant data based on domain
    const dataPromises = [];
    
    if (domain.includes('finance') || domain.includes('economy')) {
      dataPromises.push(
        supabase.from('finance_data').select('*').order('date', { ascending: false }).limit(50)
      );
    }
    
    if (domain.includes('food') || domain.includes('agriculture')) {
      dataPromises.push(
        supabase.from('food_data').select('*').order('date', { ascending: false }).limit(50)
      );
    }
    
    if (domain.includes('health')) {
      dataPromises.push(
        supabase.from('health_metrics').select('*').order('date', { ascending: false }).limit(50)
      );
    }
    
    if (domain.includes('security') || domain.includes('defense')) {
      dataPromises.push(
        supabase.from('security_events').select('*').order('timestamp', { ascending: false }).limit(50)
      );
    }
    
    if (domain.includes('governance') || domain.includes('policy')) {
      dataPromises.push(
        supabase.from('governance_global').select('*').order('year', { ascending: false }).limit(50)
      );
    }

    // Always fetch vulnerability data
    dataPromises.push(
      supabase.from('vulnerability_scores').select('*').order('calculated_at', { ascending: false }).limit(20)
    );

    const results = await Promise.all(dataPromises);
    const contextData = results.map(r => r.data).flat();

    // Build context for AI
    const dataContext = buildDataContext(contextData, domain);
    
    // Call Lovable AI for analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are J.A.R.V.I.S., the global analyst of the AICIS system. You analyze live data across finance, health, food, energy, and governance to optimize civilization-level intelligence.

Respond with detailed, structured insights in JSON format with these fields:
- summary: Brief overview of the situation
- key_metrics: Array of important metrics with values
- critical_regions: Array of regions requiring attention
- recommendations: Array of actionable recommendations
- data_sources: Array of data sources used
- risk_level: "low", "medium", "high", or "critical"
- confidence: Float between 0-1

Use a professional tone blending scientific precision with adaptive reasoning. Base your analysis on the provided data context.`
          },
          {
            role: "user",
            content: `Query: ${query}\n\nData Context:\n${dataContext}`
          }
        ]
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;
    
    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(analysis);
    } catch {
      // If AI doesn't return valid JSON, wrap it
      parsedAnalysis = {
        summary: analysis,
        key_metrics: [],
        critical_regions: [],
        recommendations: [],
        data_sources: domain,
        risk_level: "medium",
        confidence: 0.7
      };
    }

    // Log query feedback
    await supabase.from('query_feedback').insert({
      query_text: query,
      response_relevance: parsedAnalysis.confidence || 0.8,
      top_apis: { [domain[0]]: 1.0 },
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        query,
        domain,
        analysis: parsedAnalysis,
        data_points: contextData.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("jarvis-query error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function detectDomain(query: string): string[] {
  const q = query.toLowerCase();
  const domains: string[] = [];
  
  if (q.match(/\b(gdp|finance|econom|market|trade|invest|currency)\b/)) domains.push('finance');
  if (q.match(/\b(food|agricult|crop|yield|hunger|farm|famine)\b/)) domains.push('food');
  if (q.match(/\b(health|disease|pandemic|medical|hospital|mortality)\b/)) domains.push('health');
  if (q.match(/\b(security|cyber|attack|threat|defense|military)\b/)) domains.push('security');
  if (q.match(/\b(governance|policy|government|corruption|democracy)\b/)) domains.push('governance');
  if (q.match(/\b(energy|power|grid|electric|renewable)\b/)) domains.push('energy');
  
  return domains.length > 0 ? domains : ['general'];
}

function buildDataContext(data: any[], domains: string[]): string {
  if (!data || data.length === 0) {
    return `No recent data available for domains: ${domains.join(', ')}`;
  }

  const summary = data.slice(0, 20).map(item => {
    const keys = Object.keys(item).filter(k => !k.includes('id') && !k.includes('created'));
    return keys.slice(0, 5).map(k => `${k}: ${item[k]}`).join(', ');
  }).join('\n');

  return `Recent data (${data.length} records):\n${summary}`;
}
