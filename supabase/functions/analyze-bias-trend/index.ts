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
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Get recent AI decisions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: decisions, error: decisionsError } = await supabaseClient
      .from('ai_decision_logs')
      .select('*')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (decisionsError) throw decisionsError;

    // Calculate bias trends by division and model
    const trends: any = {
      by_division: {},
      by_model: {},
      overall: {
        avg_bias: 0,
        avg_confidence: 0,
        high_bias_count: 0,
        low_confidence_count: 0
      }
    };

    if (decisions && decisions.length > 0) {
      let totalBias = 0;
      let totalConfidence = 0;

      for (const decision of decisions) {
        const biasScore = Number(decision.bias_score) || 0;
        const confidence = Number(decision.confidence) || 0;

        totalBias += biasScore;
        totalConfidence += confidence;

        // Track by division
        if (!trends.by_division[decision.division_key]) {
          trends.by_division[decision.division_key] = {
            count: 0,
            total_bias: 0,
            avg_bias: 0
          };
        }
        trends.by_division[decision.division_key].count++;
        trends.by_division[decision.division_key].total_bias += biasScore;

        // Track by model
        if (!trends.by_model[decision.model_name]) {
          trends.by_model[decision.model_name] = {
            count: 0,
            total_bias: 0,
            avg_bias: 0
          };
        }
        trends.by_model[decision.model_name].count++;
        trends.by_model[decision.model_name].total_bias += biasScore;

        // Count flags
        if (biasScore > 15) trends.overall.high_bias_count++;
        if (confidence < 60) trends.overall.low_confidence_count++;
      }

      trends.overall.avg_bias = totalBias / decisions.length;
      trends.overall.avg_confidence = totalConfidence / decisions.length;

      // Calculate averages
      for (const div in trends.by_division) {
        trends.by_division[div].avg_bias = 
          trends.by_division[div].total_bias / trends.by_division[div].count;
      }
      for (const model in trends.by_model) {
        trends.by_model[model].avg_bias = 
          trends.by_model[model].total_bias / trends.by_model[model].count;
      }
    }

    // Log the analysis
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'ethics',
      action: 'bias_trend_analyzed',
      result: 'success',
      log_level: 'info',
      metadata: { trends }
    });

    return new Response(JSON.stringify({ 
      success: true,
      trends,
      period_days: 7,
      total_decisions: decisions?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-bias-trend:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});