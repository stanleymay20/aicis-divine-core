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
    const { nodeId, approve } = await req.json();
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Check admin role
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) throw new Error('Admin access required');

    // Get node details
    const { data: node, error: nodeError } = await supabaseClient
      .from('accountability_nodes')
      .select('*')
      .eq('id', nodeId)
      .single();

    if (nodeError || !node) throw new Error('Node not found');

    // Update verification status
    const { error: updateError } = await supabaseClient
      .from('accountability_nodes')
      .update({ 
        verified: approve,
        updated_at: new Date().toISOString()
      })
      .eq('id', nodeId);

    if (updateError) throw updateError;

    // Log audit trail
    await supabaseClient.from('node_audit_trail').insert({
      node_id: nodeId,
      action: approve ? 'node_verified' : 'node_rejected',
      status: approve ? 'active' : 'rejected',
      metadata: { 
        verified_by: user.id,
        org_name: node.org_name
      }
    });

    // Log to system
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'accountability',
      action: approve ? 'node_verified' : 'node_rejected',
      result: 'success',
      log_level: 'info',
      metadata: { 
        node_id: nodeId,
        org_name: node.org_name
      }
    });

    // Create ledger entry for verification
    if (approve) {
      const payload = {
        event: 'node_verified',
        node_id: nodeId,
        org_name: node.org_name,
        country: node.country,
        verified_by: user.id,
        timestamp: new Date().toISOString()
      };

      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(payload))
      );
      const hashHex = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      await supabaseClient.from('ledger_entries').insert({
        entry_type: 'compliance',
        node_id: nodeId,
        hash: hashHex,
        payload: payload,
        verified: true
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: approve ? 'Node verified successfully' : 'Node rejected',
      node: {
        id: nodeId,
        verified: approve
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in verify-node:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
