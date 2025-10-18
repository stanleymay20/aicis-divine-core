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

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "admin" || r.role === "operator");
    if (!isAdmin) throw new Error("Admin access required");

    const { proposal_id } = await req.json();

    // Get proposal
    const { data: proposal, error: proposalError } = await supabase
      .from("dao_proposals")
      .select("*")
      .eq("id", proposal_id)
      .eq("status", "approved")
      .single();

    if (proposalError) throw proposalError;

    // Check if approval exists and is approved
    const { data: approval } = await supabase
      .from("approvals")
      .select("*")
      .eq("status", "approved")
      .contains("payload", { proposal_id })
      .maybeSingle();

    if (!approval) {
      throw new Error("No approved authorization found. Admin must approve in Approvals panel first.");
    }

    // Execute safe internal actions
    const actions = proposal.actions as any[];
    const results = [];

    for (const action of actions || []) {
      try {
        if (action.type === "invoke_function" && action.function_name) {
          const { data, error } = await supabase.functions.invoke(action.function_name, {
            body: action.parameters || {},
          });
          results.push({ action: action.function_name, success: !error, data });
        } else {
          results.push({ action: action.type, success: false, error: "Unknown action type" });
        }
      } catch (err) {
        results.push({ action: action.type, success: false, error: (err as Error).message });
      }
    }

    // Mark proposal as executed
    await supabase
      .from("dao_proposals")
      .update({ status: "executed" })
      .eq("id", proposal_id);

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "dao_execute",
      user_id: user.id,
      log_level: "info",
      result: `Executed ${results.length} actions for proposal`,
      metadata: { proposal_id, results },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "dao_execute",
      division: "governance",
      user_id: user.id,
      action_description: "Executed DAO proposal actions",
      compliance_status: "compliant",
      data_accessed: { proposal_id, actions: results },
    });

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in dao-execute:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
