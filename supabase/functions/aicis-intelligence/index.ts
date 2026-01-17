import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueryContext {
  alerts: unknown[];
  crises: unknown[];
  incidents: unknown[];
  intel: unknown[];
  countryData: unknown[];
  vulnerabilities: unknown[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { query, conversationHistory = [] } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AICIS Intelligence Query:", query);

    // Extract location/country mentions from the query
    const locations = extractLocations(query);
    const topics = extractTopics(query);
    
    // Gather relevant context from the database
    const context = await gatherContext(supabase, locations, topics, query);
    
    // Build the system prompt with real data context
    const systemPrompt = buildSystemPrompt(context, locations, topics);
    
    // Call Lovable AI for intelligent response
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: "user", content: query }
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseContent = aiData.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

    // Log the intelligence query for analytics
    await supabase.from("intel_events").insert({
      division: "system",
      event_type: "intelligence_query",
      severity: "info",
      title: `Query: ${query.substring(0, 100)}`,
      description: `User queried AICIS intelligence system`,
      payload: { 
        query, 
        locations_detected: locations, 
        topics_detected: topics,
        context_items: {
          alerts: context.alerts.length,
          crises: context.crises.length,
          incidents: context.incidents.length,
          intel: context.intel.length,
        }
      },
      source_system: "AICIS Intelligence",
    });

    return new Response(
      JSON.stringify({
        success: true,
        response: responseContent,
        metadata: {
          locations_analyzed: locations,
          topics: topics,
          data_sources: {
            alerts: context.alerts.length,
            crises: context.crises.length,
            incidents: context.incidents.length,
            intel_events: context.intel.length,
            country_data: context.countryData.length,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AICIS Intelligence error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        response: "I encountered an error processing your request. Please try rephrasing your question."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Extract location mentions from query
function extractLocations(query: string): string[] {
  const q = query.toLowerCase();
  const locations: string[] = [];

  // Common country/region patterns
  const countryPatterns: Record<string, string[]> = {
    "Syria": ["syria", "syrian", "damascus", "aleppo"],
    "Ukraine": ["ukraine", "ukrainian", "kyiv", "kiev", "donbas", "crimea"],
    "Yemen": ["yemen", "yemeni", "sanaa", "aden"],
    "Sudan": ["sudan", "sudanese", "khartoum", "darfur"],
    "Palestine": ["palestine", "palestinian", "gaza", "west bank"],
    "Israel": ["israel", "israeli", "tel aviv", "jerusalem"],
    "Russia": ["russia", "russian", "moscow"],
    "China": ["china", "chinese", "beijing", "shanghai"],
    "USA": ["usa", "united states", "america", "american", "washington"],
    "India": ["india", "indian", "delhi", "mumbai"],
    "Pakistan": ["pakistan", "pakistani", "karachi", "islamabad"],
    "Afghanistan": ["afghanistan", "afghan", "kabul"],
    "Iraq": ["iraq", "iraqi", "baghdad"],
    "Iran": ["iran", "iranian", "tehran"],
    "Lebanon": ["lebanon", "lebanese", "beirut"],
    "Libya": ["libya", "libyan", "tripoli"],
    "Somalia": ["somalia", "somali", "mogadishu"],
    "Ethiopia": ["ethiopia", "ethiopian", "addis ababa"],
    "Nigeria": ["nigeria", "nigerian", "lagos", "abuja"],
    "DRC": ["congo", "drc", "kinshasa"],
    "Myanmar": ["myanmar", "burma", "burmese", "yangon"],
    "North Korea": ["north korea", "dprk", "pyongyang"],
    "South Korea": ["south korea", "seoul"],
    "Japan": ["japan", "japanese", "tokyo"],
    "Taiwan": ["taiwan", "taiwanese", "taipei"],
    "Philippines": ["philippines", "filipino", "manila"],
    "Indonesia": ["indonesia", "indonesian", "jakarta"],
    "Turkey": ["turkey", "turkish", "ankara", "istanbul"],
    "Egypt": ["egypt", "egyptian", "cairo"],
    "South Africa": ["south africa", "johannesburg", "cape town"],
    "Brazil": ["brazil", "brazilian", "sao paulo", "rio"],
    "Mexico": ["mexico", "mexican", "mexico city"],
    "Venezuela": ["venezuela", "venezuelan", "caracas"],
    "Colombia": ["colombia", "colombian", "bogota"],
    "Europe": ["europe", "european", "eu"],
    "Africa": ["africa", "african"],
    "Asia": ["asia", "asian"],
    "Middle East": ["middle east", "mideast"],
    "Latin America": ["latin america", "south america"],
  };

  for (const [country, patterns] of Object.entries(countryPatterns)) {
    for (const pattern of patterns) {
      if (q.includes(pattern)) {
        if (!locations.includes(country)) {
          locations.push(country);
        }
        break;
      }
    }
  }

  return locations;
}

// Extract topics from query
function extractTopics(query: string): string[] {
  const q = query.toLowerCase();
  const topics: string[] = [];

  const topicPatterns: Record<string, string[]> = {
    "conflict": ["war", "conflict", "fighting", "battle", "military", "attack", "violence", "bombing", "strike"],
    "humanitarian": ["humanitarian", "crisis", "refugee", "displaced", "aid", "emergency", "relief"],
    "health": ["health", "disease", "outbreak", "epidemic", "pandemic", "medical", "hospital", "covid", "cholera", "ebola"],
    "food": ["food", "hunger", "famine", "starvation", "malnutrition", "agriculture", "crop"],
    "economic": ["economic", "economy", "inflation", "currency", "trade", "sanctions", "poverty"],
    "political": ["political", "government", "election", "protest", "coup", "regime", "democracy"],
    "natural_disaster": ["earthquake", "flood", "hurricane", "typhoon", "cyclone", "tsunami", "wildfire", "drought"],
    "security": ["security", "terrorism", "terrorist", "threat", "cyber", "attack"],
    "energy": ["energy", "oil", "gas", "power", "electricity", "fuel"],
    "climate": ["climate", "environmental", "pollution", "carbon", "emissions"],
  };

  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    for (const pattern of patterns) {
      if (q.includes(pattern)) {
        if (!topics.includes(topic)) {
          topics.push(topic);
        }
        break;
      }
    }
  }

  // Default topic if none detected
  if (topics.length === 0) {
    topics.push("general_situation");
  }

  return topics;
}

// Gather relevant data from database
async function gatherContext(
  supabase: any,
  locations: string[],
  topics: string[],
  query: string
): Promise<QueryContext> {
  const context: QueryContext = {
    alerts: [],
    crises: [],
    incidents: [],
    intel: [],
    countryData: [],
    vulnerabilities: [],
  };

  const locationFilter = locations.length > 0 
    ? locations.map(l => `%${l}%`).join(",")
    : null;

  // Fetch recent alerts
  let alertsQuery = supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  
  if (locationFilter) {
    alertsQuery = alertsQuery.or(locations.map(l => `country.ilike.%${l}%,title.ilike.%${l}%,message.ilike.%${l}%`).join(","));
  }
  const { data: alerts } = await alertsQuery;
  context.alerts = alerts || [];

  // Fetch crisis events
  let crisesQuery = supabase
    .from("crisis_events")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(15);
  
  if (locationFilter) {
    crisesQuery = crisesQuery.or(locations.map(l => `region.ilike.%${l}%,kind.ilike.%${l}%`).join(","));
  }
  const { data: crises } = await crisesQuery;
  context.crises = crises || [];

  // Fetch security incidents
  let incidentsQuery = supabase
    .from("security_incidents")
    .select("*")
    .order("start_time", { ascending: false })
    .limit(15);
  
  if (locationFilter) {
    incidentsQuery = incidentsQuery.or(locations.map(l => `country.ilike.%${l}%,title.ilike.%${l}%`).join(","));
  }
  const { data: incidents } = await incidentsQuery;
  context.incidents = incidents || [];

  // Fetch intel events
  let intelQuery = supabase
    .from("intel_events")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(20);
  
  const { data: intel } = await intelQuery;
  context.intel = intel || [];

  // Fetch country-specific data if locations identified
  if (locations.length > 0) {
    for (const location of locations.slice(0, 3)) {
      const { data: countryProfile } = await supabase
        .from("country_profiles")
        .select("*")
        .ilike("country_name", `%${location}%`)
        .limit(1)
        .maybeSingle();
      
      if (countryProfile) {
        context.countryData.push(countryProfile);
      }

      const { data: vulnScore } = await supabase
        .from("vulnerability_scores")
        .select("*")
        .ilike("country", `%${location}%`)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (vulnScore) {
        context.vulnerabilities.push(vulnScore);
      }
    }
  }

  return context;
}

// Build system prompt with data context
function buildSystemPrompt(context: QueryContext, locations: string[], topics: string[]): string {
  const now = new Date().toISOString().split("T")[0];
  
  let prompt = `You are AICIS (AI Civilization Intelligence System), an advanced global intelligence and crisis response system. You provide real-time, factual analysis of global situations based on live data feeds.

Current date: ${now}

YOUR ROLE:
- Provide accurate, actionable intelligence on global situations
- Analyze crises, conflicts, humanitarian situations, and security threats
- Offer data-driven insights and recommendations
- Be direct and professional in your responses
- Cite specific data points when available
- Acknowledge limitations when data is incomplete

IMPORTANT GUIDELINES:
- Be factual and cite sources when providing information
- For ongoing conflicts/crises, provide current status, key actors, and impact
- Include casualty figures, displacement numbers, or other metrics when available
- Suggest actionable recommendations where appropriate
- If you don't have current data on something, say so and provide what historical context you can

`;

  // Add context about detected locations
  if (locations.length > 0) {
    prompt += `LOCATIONS OF INTEREST: ${locations.join(", ")}\n\n`;
  }

  // Add context about detected topics
  if (topics.length > 0) {
    prompt += `TOPICS DETECTED: ${topics.join(", ")}\n\n`;
  }

  // Add live data context
  prompt += `CURRENT INTELLIGENCE DATA:\n\n`;

  // Alerts
  if (context.alerts.length > 0) {
    prompt += `ACTIVE ALERTS (${context.alerts.length}):\n`;
    for (const alert of context.alerts.slice(0, 10)) {
      const a = alert as Record<string, unknown>;
      prompt += `- [${a.severity}] ${a.title}: ${(a.message as string)?.substring(0, 200) || "No details"} (${a.country || "Global"}, ${a.division})\n`;
    }
    prompt += "\n";
  }

  // Crises
  if (context.crises.length > 0) {
    prompt += `ACTIVE CRISES (${context.crises.length}):\n`;
    for (const crisis of context.crises.slice(0, 8)) {
      const c = crisis as Record<string, unknown>;
      prompt += `- ${c.kind} in ${c.region}: Severity ${c.severity}/10, Status: ${c.status}\n`;
      if (c.details_md) {
        prompt += `  Summary: ${(c.details_md as string).substring(0, 150)}...\n`;
      }
    }
    prompt += "\n";
  }

  // Security incidents
  if (context.incidents.length > 0) {
    prompt += `SECURITY INCIDENTS (${context.incidents.length}):\n`;
    for (const incident of context.incidents.slice(0, 8)) {
      const i = incident as Record<string, unknown>;
      prompt += `- ${i.event_type || i.title}: ${i.country || "Unknown location"} - ${(i.summary as string)?.substring(0, 150) || "No details"}\n`;
      if (i.killed || i.injured || i.displaced) {
        prompt += `  Impact: ${i.killed || 0} killed, ${i.injured || 0} injured, ${i.displaced || 0} displaced\n`;
      }
    }
    prompt += "\n";
  }

  // Intel events
  if (context.intel.length > 0) {
    prompt += `RECENT INTELLIGENCE (${context.intel.length}):\n`;
    for (const intel of context.intel.slice(0, 8)) {
      const e = intel as Record<string, unknown>;
      prompt += `- [${e.severity}] ${e.division}: ${e.title}\n`;
    }
    prompt += "\n";
  }

  // Country-specific data
  if (context.countryData.length > 0) {
    prompt += `COUNTRY PROFILES:\n`;
    for (const profile of context.countryData) {
      const p = profile as Record<string, unknown>;
      prompt += `- ${p.country_name} (${p.iso3}): `;
      if (p.summary) {
        const summary = p.summary as Record<string, unknown>;
        prompt += `${JSON.stringify(summary).substring(0, 300)}...\n`;
      }
    }
    prompt += "\n";
  }

  // Vulnerability scores
  if (context.vulnerabilities.length > 0) {
    prompt += `VULNERABILITY SCORES:\n`;
    for (const vuln of context.vulnerabilities) {
      const v = vuln as Record<string, unknown>;
      prompt += `- ${v.country}: Overall ${v.overall_score}/100 (Health: ${v.health_risk}, Food: ${v.food_risk}, Energy: ${v.energy_risk})\n`;
    }
    prompt += "\n";
  }

  // If no data found
  if (context.alerts.length === 0 && context.crises.length === 0 && context.incidents.length === 0 && context.intel.length === 0) {
    prompt += `NOTE: Limited real-time data available for this query. Provide analysis based on general knowledge while noting data limitations.\n\n`;
  }

  prompt += `\nProvide a comprehensive, professional intelligence briefing based on the user's query. Be specific with data points when available.`;

  return prompt;
}
