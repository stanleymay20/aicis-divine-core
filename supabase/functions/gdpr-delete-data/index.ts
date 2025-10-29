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

    const { reason } = await req.json();

    // Create deletion request
    const { data: deletionRequest, error: deletionError } = await supabase
      .from("data_deletion_requests")
      .insert({
        user_id: user.id,
        reason: reason || "User requested account deletion",
        status: "pending",
      })
      .select()
      .single();

    if (deletionError) throw deletionError;

    // Log audit event
    await supabase.rpc("log_audit_event", {
      _user_id: user.id,
      _org_id: null,
      _action: "data.delete",
      _resource_type: "data_deletion_request",
      _resource_id: deletionRequest.id,
      _severity: "warning",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        request_id: deletionRequest.id,
        status: "pending",
        message: "Your account deletion request has been submitted and is pending review.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in gdpr-delete-data:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
