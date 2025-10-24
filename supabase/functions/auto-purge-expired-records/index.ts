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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get retention policies
    const { data: policies, error: policiesError } = await supabaseClient
      .from('data_retention_policies')
      .select('*')
      .eq('auto_delete', true);

    if (policiesError) throw policiesError;

    const results = [];

    for (const policy of policies || []) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.max_days);

      // Handle different tables based on category
      let tableName = policy.category;
      let dateColumn = 'created_at';

      // Purge old records
      const { data: deleted, error: deleteError } = await supabaseClient
        .from(tableName)
        .delete()
        .lt(dateColumn, cutoffDate.toISOString());

      if (deleteError) {
        console.error(`Error purging ${tableName}:`, deleteError);
        results.push({ 
          category: policy.category, 
          status: 'error', 
          error: deleteError.message 
        });
      } else {
        results.push({ 
          category: policy.category, 
          status: 'success', 
          cutoff_date: cutoffDate.toISOString()
        });
      }
    }

    // Log the purge operation
    await supabaseClient.from('system_logs').insert({
      division: 'privacy',
      action: 'auto_purge_expired_records',
      result: 'completed',
      log_level: 'info',
      metadata: { results }
    });

    return new Response(JSON.stringify({ 
      success: true,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in auto-purge-expired-records:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});