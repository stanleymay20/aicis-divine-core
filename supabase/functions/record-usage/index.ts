import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const usageSchema = z.object({
      org_id: z.string().uuid(),
      metric_key: z.enum(["api_calls", "scrollcoin_tx"]),
      quantity: z.number().int().min(1).max(100000)
    });

    const input = usageSchema.parse(await req.json());

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    // Call the secure function which validates org and records usage
    const { error } = await supabase.rpc("record_usage_secure", {
      p_org: input.org_id,
      p_metric: input.metric_key,
      p_qty: input.quantity
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, recorded: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in record-usage:", e);
    
    // Handle Zod validation errors
    if (e instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: "Validation failed", 
          details: e.errors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
