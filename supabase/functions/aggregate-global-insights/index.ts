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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    console.log("Aggregating global insights across divisions...");

    const insights = [];

    // Cross-division analysis: Energy + Health
    const { data: healthData } = await supabase
      .from('health_data')
      .select('*')
      .eq('risk_level', 'critical')
      .limit(5);

    const { data: energyData } = await supabase
      .from('energy_grid')
      .select('*')
      .lt('stability_index', 70)
      .limit(5);

    if (healthData && healthData.length > 0 && energyData && energyData.length > 0) {
      const overlappingRegions = healthData
        .map(h => h.region)
        .filter(r => energyData.some(e => e.region === r));

      if (overlappingRegions.length > 0) {
        insights.push({
          insight_type: 'cross_impact',
          title: 'Critical Health Crisis in Energy-Stressed Regions',
          summary: `${overlappingRegions.length} regions facing both health emergencies and energy instability: ${overlappingRegions.join(', ')}`,
          affected_divisions: ['health', 'energy', 'crisis'],
          severity: 'high',
          confidence_score: 0.85,
          recommendations: [
            'Prioritize energy restoration for healthcare facilities',
            'Deploy emergency generators to hospitals',
            'Coordinate crisis response between divisions'
          ],
          metadata: { regions: overlappingRegions }
        });
      }
    }

    // Cross-division analysis: Food + Crisis
    const { data: foodData } = await supabase
      .from('food_security')
      .select('*')
      .eq('alert_level', 'critical')
      .limit(5);

    const { data: crisisData } = await supabase
      .from('crisis_events')
      .select('*')
      .eq('status', 'active')
      .limit(10);

    if (foodData && foodData.length > 0) {
      insights.push({
        insight_type: 'resource_shortage',
        title: 'Food Security Alert',
        summary: `${foodData.length} regions experiencing critical food supply issues`,
        affected_divisions: ['food', 'crisis', 'logistics'],
        severity: 'high',
        confidence_score: 0.90,
        recommendations: [
          'Activate emergency food distribution',
          'Optimize logistics routes to affected regions',
          'Coordinate with international aid organizations'
        ],
        metadata: { regions: foodData.map(f => f.region) }
      });
    }

    // Cross-division analysis: Finance + All
    const { data: revenueData } = await supabase
      .from('revenue_streams')
      .select('amount, division')
      .order('captured_at', { ascending: false })
      .limit(100);

    if (revenueData && revenueData.length > 0) {
      const divisionRevenue = revenueData.reduce((acc: any, curr: any) => {
        acc[curr.division] = (acc[curr.division] || 0) + Number(curr.amount);
        return acc;
      }, {});

      const topDivisions = Object.entries(divisionRevenue)
        .sort(([,a]: any, [,b]: any) => b - a)
        .slice(0, 3)
        .map(([div]) => div);

      insights.push({
        insight_type: 'financial_analysis',
        title: 'Division Revenue Performance',
        summary: `Top performing divisions: ${topDivisions.join(', ')}`,
        affected_divisions: ['finance', ...topDivisions],
        severity: 'info',
        confidence_score: 0.95,
        recommendations: [
          'Scale successful division strategies',
          'Investigate underperforming divisions',
          'Optimize resource allocation'
        ],
        metadata: { division_revenue: divisionRevenue }
      });
    }

    // Insert insights
    if (insights.length > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      for (const insight of insights) {
        await supabase.from('global_insights').insert({
          ...insight,
          expires_at: expiresAt.toISOString()
        });
      }

      // Notify users about high severity insights
      const highSeverityInsights = insights.filter(i => i.severity === 'high' || i.severity === 'critical');
      for (const insight of highSeverityInsights) {
        await supabase.from('notifications').insert({
          type: 'insight',
          title: insight.title,
          message: insight.summary,
          division: insight.affected_divisions[0],
          user_id: user.id
        });
      }
    }

    await supabase.from('system_logs').insert({
      level: 'info',
      category: 'intelligence',
      message: `Generated ${insights.length} global insights`,
      metadata: { insight_count: insights.length }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Global insights aggregated",
        insights_count: insights.length,
        insights 
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("aggregate-global-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
