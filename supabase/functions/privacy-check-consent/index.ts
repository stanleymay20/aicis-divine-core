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
    const { userId } = await req.json();
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Check if user has active consent
    const { data: consent, error: consentError } = await supabaseClient
      .from('user_consent')
      .select('*')
      .eq('user_id', userId || user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (consentError && consentError.code !== 'PGRST116') {
      throw consentError;
    }

    const hasConsent = !!consent;

    // Log the check
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'privacy',
      action: 'consent_check',
      result: hasConsent ? 'valid' : 'missing',
      log_level: 'info',
      metadata: { checked_user_id: userId || user.id }
    });

    return new Response(JSON.stringify({ 
      hasConsent,
      consent: consent || null,
      message: hasConsent ? 'Valid consent found' : 'No active consent'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in privacy-check-consent:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});