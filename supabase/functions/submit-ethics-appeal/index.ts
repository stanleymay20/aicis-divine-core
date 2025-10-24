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
    const { decisionId, reason } = await req.json();
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Verify decision exists
    const { data: decision, error: decisionError } = await supabaseClient
      .from('ai_decision_logs')
      .select('*')
      .eq('id', decisionId)
      .single();

    if (decisionError || !decision) {
      throw new Error('Decision not found');
    }

    // Create ethics case
    const { data: ethicsCase, error: caseError } = await supabaseClient
      .from('ethics_cases')
      .insert({
        decision_id: decisionId,
        reason: reason,
        status: 'pending'
      })
      .select()
      .single();

    if (caseError) throw caseError;

    // Create notification for ethics reviewers
    const { data: reviewers } = await supabaseClient
      .from('ethics_reviewers')
      .select('user_id');

    if (reviewers) {
      for (const reviewer of reviewers) {
        await supabaseClient.from('notifications').insert({
          user_id: reviewer.user_id,
          type: 'ethics_appeal',
          title: 'New Ethics Appeal',
          message: `An ethics appeal has been submitted for decision ${decisionId}`,
          division: 'ethics',
          link: `/ethics/cases/${ethicsCase.id}`
        });
      }
    }

    // Log the appeal
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'ethics',
      action: 'ethics_appeal_submitted',
      result: 'success',
      log_level: 'info',
      metadata: { 
        case_id: ethicsCase.id,
        decision_id: decisionId
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      ethics_case: ethicsCase
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in submit-ethics-appeal:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});