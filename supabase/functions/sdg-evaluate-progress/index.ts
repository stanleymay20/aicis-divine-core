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

    // Get all SDG mappings
    const { data: mappings, error: mappingsError } = await supabaseClient
      .from('sdg_mappings')
      .select('*');

    if (mappingsError) throw mappingsError;

    // Calculate progress for each SDG goal
    const sdgProgress = [];
    
    for (let goal = 1; goal <= 17; goal++) {
      const goalMappings = mappings?.filter(m => m.sdg_goal === goal) || [];
      
      // Calculate mock progress based on division performance
      const { data: divisions } = await supabaseClient
        .from('ai_divisions')
        .select('performance_score')
        .in('division_key', goalMappings.map(m => m.division_key));

      const avgPerformance = divisions?.length 
        ? divisions.reduce((sum, d) => sum + Number(d.performance_score), 0) / divisions.length
        : 0;

      const progressPercent = Math.min(100, Math.max(0, avgPerformance * 0.8));

      // Upsert progress
      const { error: upsertError } = await supabaseClient
        .from('sdg_progress')
        .upsert({
          goal,
          target: `Goal ${goal}`,
          current_value: avgPerformance,
          progress_percent: progressPercent,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'goal,target'
        });

      if (upsertError) {
        console.error(`Error upserting SDG ${goal}:`, upsertError);
      }

      sdgProgress.push({
        goal,
        progress_percent: progressPercent,
        mappings_count: goalMappings.length
      });
    }

    // Log the evaluation
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'sdg',
      action: 'evaluate_progress',
      result: 'success',
      log_level: 'info',
      metadata: { sdg_progress: sdgProgress }
    });

    return new Response(JSON.stringify({ 
      success: true,
      sdg_progress: sdgProgress,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in sdg-evaluate-progress:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});