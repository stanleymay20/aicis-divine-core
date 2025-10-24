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
    const { 
      modelName, 
      divisionKey, 
      inputSummary, 
      outputSummary, 
      confidence, 
      explanation 
    } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Calculate bias score (simplified)
    const biasScore = confidence ? (100 - confidence) / 10 : 5;
    
    // Determine ethical flags
    const ethicalFlags = [];
    if (confidence && confidence < 60) ethicalFlags.push('low_confidence');
    if (biasScore > 15) ethicalFlags.push('high_bias');

    // Insert decision log
    const { data: log, error: logError } = await supabaseClient
      .from('ai_decision_logs')
      .insert({
        model_name: modelName,
        division_key: divisionKey,
        input_summary: inputSummary,
        output_summary: outputSummary,
        confidence: confidence,
        bias_score: biasScore,
        ethical_flags: ethicalFlags,
        explanation: explanation || {}
      })
      .select()
      .single();

    if (logError) throw logError;

    // Log system action
    await supabaseClient.from('system_logs').insert({
      division: divisionKey,
      action: 'ai_decision_logged',
      result: 'success',
      log_level: 'info',
      metadata: { 
        decision_id: log.id, 
        model: modelName,
        bias_score: biasScore,
        ethical_flags: ethicalFlags
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      decision_log: log
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in log-ai-decision:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});