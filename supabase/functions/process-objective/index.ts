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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { objective } = await req.json();
    console.log("Processing objective:", objective);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Use AI to generate strategic plan
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are AICIS Strategic Planner. Break objectives into actionable division tasks using existing functions:
- pull-coingecko (finance: crypto market data)
- pull-owid-energy (energy: grid data)
- pull-faostat-food (food: crop yields)
- pull-owid-health (health: disease surveillance)
- detect-anomalies (all divisions: anomaly detection)
- analyze-global-status (system: cross-division analysis)
- predict-risks (all divisions: risk forecasting)
- governance-scan (governance: policy analysis)
- defense-posture-refresh (defense: threat assessment)
- diplomacy-scan (diplomacy: geopolitical signals)
- crisis-scan (crisis: event monitoring)

Output ONLY a JSON array of tasks with this structure:
[{"division":"finance","action":"Pull market data","function_name":"pull-coingecko","parameters":{}},...]`
          },
          {
            role: "user",
            content: `Objective: ${objective}\n\nGenerate a strategic execution plan as a JSON array.`
          }
        ]
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const planText = aiData.choices?.[0]?.message?.content ?? "[]";
    console.log("AI plan response:", planText);

    // Extract JSON array from response
    let tasks: any[] = [];
    try {
      const jsonMatch = planText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        tasks = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn("Failed to parse AI plan, using empty tasks:", e);
      tasks = [];
    }

    console.log("Parsed tasks:", tasks);

    // Create objective record
    const { data: objectiveRecord, error: objectiveError } = await supabase
      .from("objectives")
      .insert({
        issued_by: user.id,
        objective_text: objective,
        ai_plan: tasks,
        status: "pending"
      })
      .select()
      .single();

    if (objectiveError) throw objectiveError;

    console.log("Created objective:", objectiveRecord.id);

    // Create task records
    const taskInserts = tasks.map((t) => ({
      objective_id: objectiveRecord.id,
      division: t.division || "system",
      action: t.action || "Execute task",
      function_name: t.function_name,
      parameters: t.parameters || {},
      status: "queued"
    }));

    if (taskInserts.length > 0) {
      const { error: tasksError } = await supabase
        .from("objective_tasks")
        .insert(taskInserts);

      if (tasksError) throw tasksError;
    }

    // Log to system
    await supabase.from("system_logs").insert({
      action: "process_objective",
      division: "system",
      user_id: user.id,
      log_level: "info",
      result: `Objective processed: ${objective}`,
      metadata: { tasks: tasks.length, objective_id: objectiveRecord.id }
    });

    await supabase.from("compliance_audit").insert({
      action_type: "strategic_planning",
      division: "system",
      user_id: user.id,
      action_description: `Processed strategic objective: ${objective}`,
      compliance_status: "compliant",
      data_accessed: { objective_id: objectiveRecord.id, task_count: tasks.length }
    });

    return new Response(
      JSON.stringify({
        ok: true,
        objective: objectiveRecord,
        tasks: taskInserts,
        message: `Objective processed with ${tasks.length} tasks`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-objective error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
