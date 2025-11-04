import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter((v) => !Deno.env.get(v));
  const result: any = { 
    ok: true, 
    missingEnv: missing, 
    authStatus: null,
    timestamp: new Date().toISOString()
  };

  try {
    if (missing.length > 0) {
      result.ok = false;
      result.message = 'Missing environment variables';
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(url, key);
    
    // Test auth configuration
    const { data: { session } } = await supabase.auth.getSession();
    result.authStatus = '✅ Supabase Auth responding';
    
    // Test database connection
    const { error: dbError } = await supabase.from('user_roles').select('*').limit(1);
    if (dbError) {
      result.dbStatus = `⚠️ Database: ${dbError.message}`;
    } else {
      result.dbStatus = '✅ Database connected';
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    result.ok = false;
    result.error = err.message;
    return new Response(JSON.stringify(result, null, 2), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
