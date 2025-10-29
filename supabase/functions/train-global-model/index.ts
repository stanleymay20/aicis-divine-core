import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting AI training cycle...");

    // 1. Analyze query feedback to identify most valuable data sources
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('query_feedback')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (feedbackError) throw feedbackError;

    const sourceContributions: Record<string, { count: number; avgRelevance: number }> = {};
    
    feedbackData?.forEach((feedback: any) => {
      if (feedback.top_apis) {
        Object.entries(feedback.top_apis).forEach(([source, score]) => {
          if (!sourceContributions[source]) {
            sourceContributions[source] = { count: 0, avgRelevance: 0 };
          }
          sourceContributions[source].count++;
          sourceContributions[source].avgRelevance += (score as number);
        });
      }
    });

    // Normalize averages
    Object.keys(sourceContributions).forEach(source => {
      sourceContributions[source].avgRelevance /= sourceContributions[source].count;
    });

    // 2. Update data collection priorities based on feedback
    const { data: triggers } = await supabase
      .from('data_collection_triggers')
      .select('*')
      .eq('enabled', true);

    const priorityUpdates = triggers?.map(trigger => {
      const contribution = sourceContributions[trigger.target_source];
      let newPriority = trigger.priority;
      
      if (contribution) {
        if (contribution.avgRelevance > 0.8) newPriority = 'critical';
        else if (contribution.avgRelevance > 0.6) newPriority = 'high';
        else if (contribution.avgRelevance > 0.4) newPriority = 'medium';
        else newPriority = 'low';
      }
      
      return {
        id: trigger.id,
        priority: newPriority,
        updated_at: new Date().toISOString()
      };
    }) || [];

    // 3. Calculate global vulnerability patterns
    const { data: vulnerabilities } = await supabase
      .from('vulnerability_scores')
      .select('*')
      .gte('calculated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('calculated_at', { ascending: false });

    const vulnerabilityTrends: Record<string, any> = {};
    
    vulnerabilities?.forEach((v: any) => {
      if (!vulnerabilityTrends[v.country]) {
        vulnerabilityTrends[v.country] = {
          scores: [],
          risks: { health: [], food: [], energy: [], climate: [], economic: [] }
        };
      }
      vulnerabilityTrends[v.country].scores.push(v.overall_score);
      vulnerabilityTrends[v.country].risks.health.push(v.health_risk);
      vulnerabilityTrends[v.country].risks.food.push(v.food_risk);
      vulnerabilityTrends[v.country].risks.energy.push(v.energy_risk);
    });

    // 4. Identify high-risk countries for increased monitoring
    const highRiskCountries = Object.entries(vulnerabilityTrends)
      .filter(([_, data]: any) => {
        const avgScore = data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length;
        return avgScore > 70; // High vulnerability threshold
      })
      .map(([country, _]) => country);

    // 5. Store training insights
    const trainingInsights = {
      timestamp: new Date().toISOString(),
      queries_analyzed: feedbackData?.length || 0,
      source_contributions: sourceContributions,
      high_risk_countries: highRiskCountries,
      priority_updates: priorityUpdates.length,
      recommendations: {
        increase_monitoring: highRiskCountries,
        prioritize_sources: Object.entries(sourceContributions)
          .sort((a, b) => b[1].avgRelevance - a[1].avgRelevance)
          .slice(0, 5)
          .map(([source, _]) => source)
      }
    };

    // Log training cycle
    await supabase.from('ai_learning_log').insert({
      source_table: 'query_feedback',
      success: true,
      insight: JSON.stringify(trainingInsights)
    });

    await supabase.from('automation_logs').insert({
      job_name: 'train-global-model',
      status: 'success',
      message: `Training complete. Analyzed ${feedbackData?.length || 0} queries, identified ${highRiskCountries.length} high-risk areas`
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: 'AI training cycle completed successfully',
        insights: trainingInsights
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("train-global-model error:", e);
    
    await createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    ).from('automation_logs').insert({
      job_name: 'train-global-model',
      status: 'error',
      message: e instanceof Error ? e.message : 'Unknown error'
    });

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
