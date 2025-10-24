import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-aicis-node-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entryType, payload, signature } = await req.json();
    const nodeKey = req.headers.get('X-AICIS-Node-Key');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify node API key
    let nodeId = null;
    if (nodeKey) {
      const { data: node } = await supabaseClient
        .from('accountability_nodes')
        .select('id, verified')
        .eq('api_key', nodeKey)
        .single();

      if (!node || !node.verified) {
        throw new Error('Invalid or unverified node key');
      }
      nodeId = node.id;
    }

    // Get previous hash for chain integrity
    const { data: lastEntry } = await supabaseClient
      .from('ledger_entries')
      .select('hash')
      .order('block_number', { ascending: false })
      .limit(1)
      .single();

    const previousHash = lastEntry?.hash || 'genesis';

    // Compute hash for this entry
    const entryData = {
      entry_type: entryType,
      payload: payload,
      previous_hash: previousHash,
      timestamp: new Date().toISOString()
    };

    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(entryData))
    );
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Insert ledger entry
    const { data: entry, error: entryError } = await supabaseClient
      .from('ledger_entries')
      .insert({
        entry_type: entryType,
        node_id: nodeId,
        hash: hash,
        payload: payload,
        signature: signature,
        previous_hash: previousHash,
        verified: !!signature
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Log audit trail if node-based
    if (nodeId) {
      await supabaseClient.from('node_audit_trail').insert({
        node_id: nodeId,
        action: 'ledger_entry_added',
        status: 'success',
        metadata: { 
          entry_id: entry.id,
          entry_type: entryType,
          hash: hash
        }
      });
    }

    console.log(`Ledger entry added: ${hash}`);

    return new Response(JSON.stringify({ 
      success: true,
      entry: {
        id: entry.id,
        hash: hash,
        block_number: entry.block_number,
        verified: entry.verified
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ledger-add-entry:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
