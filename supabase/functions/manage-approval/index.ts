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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, approval_id, decision, division, action_text, payload } = await req.json();
    const startTime = Date.now();

    if (action === 'create') {
      console.log('Creating approval request:', { division, action_text, user: user.id });

      const { data: approval, error: insertError } = await supabaseClient
        .from('approvals')
        .insert({
          requester: user.id,
          division,
          action: action_text,
          payload,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      await supabaseClient.from('system_logs').insert({
        action: 'approval_requested',
        division,
        user_id: user.id,
        log_level: 'info',
        result: `Approval request created: ${action_text}`,
        metadata: { approval_id: approval.id }
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: '✅ Approval request created',
          approval,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'decide') {
      const { data: userRole } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!userRole || userRole.role !== 'admin') {
        throw new Error('Only admins can decide approvals');
      }

      console.log('Deciding approval:', { approval_id, decision, user: user.id });

      const { data: approval, error: updateError } = await supabaseClient
        .from('approvals')
        .update({
          status: decision,
          decided_at: new Date().toISOString(),
          decided_by: user.id,
        })
        .eq('id', approval_id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      await supabaseClient.from('system_logs').insert({
        action: 'approval_decided',
        division: approval.division,
        user_id: user.id,
        log_level: 'info',
        result: `Approval ${decision}: ${approval.action}`,
        metadata: { approval_id, decision }
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `✅ Approval ${decision}`,
          approval,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action. Use "create" or "decide".');

  } catch (error) {
    console.error('Manage approval error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});