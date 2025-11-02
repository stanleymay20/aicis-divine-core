import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Analyze last 30 days of data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Get vulnerability patterns
    const { data: vulnerabilities } = await supabase
      .from('vulnerability_scores')
      .select('*')
      .gte('computed_at', thirtyDaysAgo);
    
    // Get alerts patterns
    const { data: alerts } = await supabase
      .from('critical_alerts')
      .select('*')
      .gte('triggered_at', thirtyDaysAgo);
    
    // Analyze source performance
    const sourcePerformance: Record<string, {count: number, avgSeverity: number}> = {};
    
    alerts?.forEach((alert: any) => {
      const source = alert.meta?.source || 'unknown';
      if (!sourcePerformance[source]) {
        sourcePerformance[source] = {count: 0, avgSeverity: 0};
      }
      sourcePerformance[source].count++;
      sourcePerformance[source].avgSeverity += alert.severity || 0;
    });
    
    // Calculate averages
    Object.keys(sourcePerformance).forEach(source => {
      const perf = sourcePerformance[source];
      perf.avgSeverity = perf.count > 0 ? perf.avgSeverity / perf.count : 0;
    });
    
    // Log learning outcome
    const { error: logError } = await supabase
      .from('ai_learning_log')
      .insert({
        source_table: 'critical_alerts',
        success: true,
        insight: JSON.stringify({
          period: '30_days',
          vulnerabilities_analyzed: vulnerabilities?.length || 0,
          alerts_analyzed: alerts?.length || 0,
          source_performance: sourcePerformance,
          timestamp: new Date().toISOString()
        })
      });

    console.log('Training complete:', sourcePerformance);

    return new Response(JSON.stringify({ 
      ok: true,
      analyzed: {
        vulnerabilities: vulnerabilities?.length || 0,
        alerts: alerts?.length || 0
      },
      sourcePerformance
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in train-global-model:', error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
