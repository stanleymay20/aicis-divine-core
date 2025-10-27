import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const commandSchema = z.object({
      command: z.string().trim().min(1, "Command cannot be empty").max(5000, "Command too long")
    });
    
    const rawBody = await req.json();
    const { command } = commandSchema.parse(rawBody);
    
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Call Lovable AI for intelligent command processing
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
            content: 'You are J.A.R.V.I.S., the AI assistant for AICIS Command Center. Respond as a professional AI system managing global operations across finance, defense, energy, health, food security, and governance. Keep responses concise and actionable.'
          },
          { role: 'user', content: command }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI Gateway error:', aiResponse.status, await aiResponse.text());
      throw new Error('AI processing failed');
    }

    const aiData = await aiResponse.json();
    const response = aiData.choices[0].message.content;

    // Log command in database
    await supabaseClient.from('command_history').insert({
      user_id: user.id,
      command,
      response,
      success: true,
      execution_time_ms: Date.now()
    });

    // Log system action
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'assistant',
      action: 'command_executed',
      result: 'success',
      log_level: 'info',
      metadata: { command, response }
    });

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in jarvis-command:', error);
    
    // Handle validation errors separately
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input",
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
