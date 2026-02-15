import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { structuredLog, handleCors, errorResponse, jsonResponse } from '../_shared/resilience.ts';

const FN = 'diagnose-auth';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const start = Date.now();
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((v) => !Deno.env.get(v));

  const result: any = { ok: true, missingEnv: missing, authStatus: null, timestamp: new Date().toISOString() };

  try {
    if (missing.length > 0) {
      result.ok = false;
      result.message = 'Missing environment variables';
      structuredLog('error', FN, 'Missing env vars', { missing });
      return jsonResponse(result);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);

    await supabase.auth.getSession();
    result.authStatus = '✅ Auth responding';

    const { error: dbError } = await supabase.from('user_roles').select('*').limit(1);
    result.dbStatus = dbError ? `⚠️ Database: ${dbError.message}` : '✅ Database connected';

    structuredLog('info', FN, 'Diagnosis complete', undefined, start);
    return jsonResponse(result);
  } catch (err: any) {
    result.ok = false;
    result.error = err.message;
    structuredLog('error', FN, err.message, undefined, start);
    return errorResponse(err);
  }
});
