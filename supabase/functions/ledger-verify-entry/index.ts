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
    const { entryId } = await req.json();
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get entry
    const { data: entry, error: entryError } = await supabaseClient
      .from('ledger_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (entryError || !entry) throw new Error('Entry not found');

    // Recompute hash
    const entryData = {
      entry_type: entry.entry_type,
      payload: entry.payload,
      previous_hash: entry.previous_hash,
      timestamp: entry.timestamp
    };

    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(entryData))
    );
    const computedHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = computedHash === entry.hash;

    // Check chain integrity
    let chainValid = true;
    if (entry.previous_hash && entry.previous_hash !== 'genesis') {
      const { data: prevEntry } = await supabaseClient
        .from('ledger_entries')
        .select('hash')
        .eq('hash', entry.previous_hash)
        .single();

      chainValid = !!prevEntry;
    }

    return new Response(JSON.stringify({ 
      success: true,
      verification: {
        entry_id: entryId,
        hash_valid: isValid,
        chain_valid: chainValid,
        overall_valid: isValid && chainValid,
        computed_hash: computedHash,
        stored_hash: entry.hash,
        block_number: entry.block_number
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ledger-verify-entry:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
