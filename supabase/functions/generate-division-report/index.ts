import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    console.log("Generating comprehensive division report...");

    // Get all divisions
    const { data: divisions } = await supabase
      .from('ai_divisions')
      .select('*')
      .order('performance_score', { ascending: false });

    if (!divisions) throw new Error("No divisions found");

    // Calculate global metrics
    const avgPerformance = divisions.reduce((sum, d) => sum + Number(d.performance_score), 0) / divisions.length;
    const avgUptime = divisions.reduce((sum, d) => sum + Number(d.uptime_percentage), 0) / divisions.length;
    const operationalCount = divisions.filter(d => d.status === 'operational').length;
    const degradedCount = divisions.filter(d => d.status === 'degraded').length;
    const offlineCount = divisions.filter(d => d.status === 'offline').length;

    // Get recent anomalies
    const { data: recentAnomalies } = await supabase
      .from('anomaly_detections')
      .select('*')
      .eq('status', 'active')
      .order('detected_at', { ascending: false })
      .limit(10);

    // Get recent insights
    const { data: recentInsights } = await supabase
      .from('global_insights')
      .select('*')
      .gte('generated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('generated_at', { ascending: false })
      .limit(5);

    // Get active crises
    const { count: activeCrises } = await supabase
      .from('crisis_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Build report content
    const reportContent = `
# AICIS Global Division Status Report
**Generated:** ${new Date().toISOString()}

## Executive Summary
- **Global Performance Score:** ${avgPerformance.toFixed(2)}%
- **Global Uptime:** ${avgUptime.toFixed(2)}%
- **Status Distribution:** ${operationalCount} Operational, ${degradedCount} Degraded, ${offlineCount} Offline
- **Active Crises:** ${activeCrises || 0}
- **Active Anomalies:** ${recentAnomalies?.length || 0}

## Division Performance

${divisions.map(d => `
### ${d.name} (${d.division_key})
- **Performance:** ${Number(d.performance_score).toFixed(2)}%
- **Uptime:** ${Number(d.uptime_percentage).toFixed(2)}%
- **Status:** ${d.status.toUpperCase()}
- **API Connected:** ${d.api_connected ? 'Yes' : 'No'}
- **Last Synced:** ${d.last_synced_at ? new Date(d.last_synced_at).toLocaleString() : 'Never'}
`).join('\n')}

## Recent Anomalies
${recentAnomalies && recentAnomalies.length > 0 
  ? recentAnomalies.map(a => `
- **${a.division}** | ${a.severity.toUpperCase()}: ${a.description}
  - Detected: ${new Date(a.detected_at).toLocaleString()}
  `).join('\n')
  : 'No active anomalies detected.'}

## Global Insights
${recentInsights && recentInsights.length > 0
  ? recentInsights.map(i => `
- **${i.title}** (${i.severity.toUpperCase()})
  - ${i.summary}
  - Affected Divisions: ${i.affected_divisions.join(', ')}
  - Confidence: ${(i.confidence_score * 100).toFixed(0)}%
  `).join('\n')
  : 'No recent insights generated.'}

## Recommendations
${divisions.filter(d => d.status !== 'operational').length > 0
  ? `
- **Priority Actions Required:**
${divisions.filter(d => d.status !== 'operational').map(d => 
  `  - Investigate ${d.name} ${d.status} status`
).join('\n')}
  `
  : '- All divisions operating nominally'}

${recentAnomalies && recentAnomalies.filter((a: any) => a.severity === 'critical').length > 0
  ? `
- **Critical Anomalies Require Immediate Attention:**
${recentAnomalies.filter((a: any) => a.severity === 'critical').map((a: any) => 
  `  - ${a.division}: ${a.description}`
).join('\n')}
  `
  : ''}

---
*Report generated automatically by AICIS Intelligence Engine*
    `.trim();

    // Store report
    await supabase.from('ai_reports').insert({
      division: 'system',
      title: `Global Division Status Report - ${new Date().toLocaleDateString()}`,
      content: reportContent
    });

    // Log report generation
    await supabase.from('system_logs').insert({
      level: 'info',
      category: 'reporting',
      message: 'Generated global division status report',
      metadata: {
        divisions_count: divisions.length,
        avg_performance: avgPerformance,
        status_distribution: { operationalCount, degradedCount, offlineCount }
      }
    });

    // Send notification
    await supabase.from('notifications').insert({
      type: 'report',
      title: 'Global Division Report Generated',
      message: `Report includes ${divisions.length} divisions, ${recentAnomalies?.length || 0} anomalies, and ${recentInsights?.length || 0} insights`,
      division: 'system',
      user_id: user.id
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Division report generated",
        report: reportContent,
        metrics: {
          divisions_count: divisions.length,
          avg_performance: avgPerformance,
          avg_uptime: avgUptime,
          operational: operationalCount,
          degraded: degradedCount,
          offline: offlineCount
        }
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-division-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
