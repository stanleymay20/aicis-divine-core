import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running node activity verification...');

    // Get all verified nodes
    const { data: nodes, error: nodesError } = await supabaseClient
      .from('accountability_nodes')
      .select('*')
      .eq('verified', true);

    if (nodesError) throw nodesError;

    let activeCount = 0;
    let inactiveCount = 0;

    for (const node of nodes || []) {
      // Check last activity from audit trail
      const { data: lastActivity } = await supabaseClient
        .from('node_audit_trail')
        .select('timestamp')
        .eq('node_id', node.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      const lastActiveAt = lastActivity?.timestamp || node.joined_at;
      const hoursSinceActive = (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60);

      // Consider inactive if no activity in 72 hours
      if (hoursSinceActive > 72) {
        inactiveCount++;
        
        // Update node
        await supabaseClient
          .from('accountability_nodes')
          .update({ last_active_at: lastActiveAt })
          .eq('id', node.id);

        // Log warning
        await supabaseClient.from('system_logs').insert({
          division: 'accountability',
          action: 'node_inactive_warning',
          result: 'warning',
          log_level: 'warn',
          metadata: { 
            node_id: node.id,
            org_name: node.org_name,
            hours_inactive: Math.round(hoursSinceActive)
          }
        });
      } else {
        activeCount++;
        await supabaseClient
          .from('accountability_nodes')
          .update({ last_active_at: lastActiveAt })
          .eq('id', node.id);
      }
    }

    const summary = `Verified ${nodes?.length || 0} nodes: ${activeCount} active, ${inactiveCount} inactive`;

    // Log automation
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-verify-node-activity',
      status: 'success',
      message: summary,
      executed_at: new Date().toISOString()
    });

    console.log(summary);

    return new Response(JSON.stringify({ 
      success: true,
      total_nodes: nodes?.length || 0,
      active_nodes: activeCount,
      inactive_nodes: inactiveCount
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in cron-verify-node-activity:', error);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-verify-node-activity',
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
