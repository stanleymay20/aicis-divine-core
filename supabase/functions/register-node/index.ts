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
      orgName, 
      country, 
      orgType, 
      jurisdiction, 
      contactEmail,
      pgpPublicKey,
      apiEndpoint 
    } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Create new accountability node
    const { data: node, error: nodeError } = await supabaseClient
      .from('accountability_nodes')
      .insert({
        org_name: orgName,
        country: country,
        org_type: orgType,
        jurisdiction: jurisdiction,
        contact_email: contactEmail,
        pgp_public_key: pgpPublicKey,
        api_endpoint: apiEndpoint,
        verified: false
      })
      .select()
      .single();

    if (nodeError) throw nodeError;

    // Log audit trail
    await supabaseClient.from('node_audit_trail').insert({
      node_id: node.id,
      action: 'node_registered',
      status: 'pending_verification',
      metadata: { 
        registered_by: user.id,
        org_type: orgType,
        jurisdiction: jurisdiction
      }
    });

    // Create notification for admins
    const { data: admins } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (admins) {
      for (const admin of admins) {
        await supabaseClient.from('notifications').insert({
          user_id: admin.user_id,
          type: 'info',
          title: 'New Node Registration',
          message: `${orgName} from ${country} has requested to join the accountability network.`,
          division: 'accountability',
          link: `/accountability/nodes/${node.id}`
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      node: {
        id: node.id,
        org_name: node.org_name,
        api_key: node.api_key,
        verified: node.verified,
        message: 'Node registered successfully. Awaiting admin verification.'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in register-node:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
