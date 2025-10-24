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
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get all verified ledger entries
    const { data: entries, error: entriesError } = await supabaseClient
      .from('ledger_entries')
      .select('id, entry_type, hash, payload, block_number, timestamp, verified')
      .eq('verified', true)
      .order('block_number', { ascending: true });

    if (entriesError) throw entriesError;

    // Get latest root hash
    const { data: rootHash } = await supabaseClient
      .from('ledger_root_hashes')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    const snapshot = {
      exported_at: new Date().toISOString(),
      total_entries: entries?.length || 0,
      latest_root_hash: rootHash?.root_hash || null,
      entries: entries || []
    };

    if (format === 'csv') {
      // Convert to CSV
      const csvLines = [
        'Block Number,Hash,Entry Type,Timestamp,Verified',
        ...entries!.map(e => 
          `${e.block_number},"${e.hash}","${e.entry_type}","${e.timestamp}",${e.verified}`
        )
      ];
      
      return new Response(csvLines.join('\n'), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ledger-snapshot-${Date.now()}.csv"`
        },
      });
    }

    return new Response(JSON.stringify(snapshot, null, 2), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ledger-snapshot-${Date.now()}.json"`
      },
    });
  } catch (error) {
    console.error('Error in ledger-export-snapshot:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
