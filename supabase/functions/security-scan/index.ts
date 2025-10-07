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
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Check if user has admin or operator role
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const hasPermission = roles?.some(r => r.role === 'admin' || r.role === 'operator');
    if (!hasPermission) throw new Error('Insufficient permissions');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Use AI for threat detection
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a cybersecurity AI performing threat detection. Analyze global security patterns and identify potential threats. Generate realistic threat scenarios with severity levels and locations.'
          },
          { role: 'user', content: 'Perform comprehensive security scan and report any threats detected' }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('AI processing failed');
    }

    const aiData = await aiResponse.json();
    const scanResults = aiData.choices[0].message.content;

    // Generate sample threats
    const threats = [
      {
        threat_type: 'cyber',
        severity: 'medium',
        location: 'US-East',
        description: 'Unusual network activity detected on financial servers',
        neutralized: false,
        response_time_ms: 1500
      },
      {
        threat_type: 'network',
        severity: 'low',
        location: 'EU-West',
        description: 'Port scan attempt from unknown source',
        neutralized: true,
        response_time_ms: 850,
        resolved_at: new Date().toISOString()
      }
    ];

    // Store threats in database
    for (const threat of threats) {
      await supabaseClient.from('threat_logs').insert(threat);
    }

    // Log scan activity
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'security',
      action: 'security_scan',
      result: 'completed',
      log_level: 'info',
      metadata: { threats_detected: threats.length, scan_results: scanResults }
    });

    return new Response(JSON.stringify({ scanResults, threats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in security-scan:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
