import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running daily ledger root hash computation...');

    // Get all verified ledger entries
    const { data: entries, error: entriesError } = await supabaseClient
      .from('ledger_entries')
      .select('hash')
      .eq('verified', true)
      .order('block_number', { ascending: true });

    if (entriesError) throw entriesError;

    if (!entries || entries.length === 0) {
      console.log('No verified entries found');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No entries to hash'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Compute root hash from all entry hashes
    const allHashes = entries.map(e => e.hash).join('');
    const rootHashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(allHashes)
    );
    const rootHash = Array.from(new Uint8Array(rootHashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Insert root hash record
    const { data: rootRecord, error: rootError } = await supabaseClient
      .from('ledger_root_hashes')
      .insert({
        root_hash: rootHash,
        block_count: entries.length,
        verified: true,
        metadata: {
          computation_date: new Date().toISOString(),
          entries_count: entries.length
        }
      })
      .select()
      .single();

    if (rootError) throw rootError;

    // Log automation
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-ledger-root-hash',
      status: 'success',
      message: `Root hash computed: ${rootHash.substring(0, 16)}... (${entries.length} entries)`,
      executed_at: new Date().toISOString()
    });

    console.log(`Root hash computed: ${rootHash}`);

    return new Response(JSON.stringify({ 
      success: true,
      root_hash: rootHash,
      block_count: entries.length,
      record_id: rootRecord.id
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in cron-ledger-root-hash:', error);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-ledger-root-hash',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      executed_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
