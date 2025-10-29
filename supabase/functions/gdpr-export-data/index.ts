import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Create export request
    const { data: exportRequest, error: exportError } = await supabase
      .from("data_export_requests")
      .insert({
        user_id: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (exportError) throw exportError;

    // Log audit event
    await supabase.rpc("log_audit_event", {
      _user_id: user.id,
      _org_id: null,
      _action: "data.export",
      _resource_type: "data_export_request",
      _resource_id: exportRequest.id,
      _severity: "info",
    });

    // In production, trigger async job to compile data
    // For now, return pending status
    return new Response(
      JSON.stringify({
        ok: true,
        request_id: exportRequest.id,
        status: "pending",
        message: "Your data export request has been received. You will be notified when it's ready.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in gdpr-export-data:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
