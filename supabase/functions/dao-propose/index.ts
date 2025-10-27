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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Validate input
    const proposalSchema = z.object({
      space_slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/, "Space slug must be lowercase alphanumeric with hyphens").optional(),
      title: z.string().trim().min(5, "Title too short").max(200, "Title too long"),
      body_md: z.string().trim().min(10, "Body too short").max(50000, "Body too long"),
      actions: z.array(z.any()).max(10, "Too many actions").optional(),
      voting_window_hours: z.number().int().min(1).max(720).optional()
    });
    
    const rawBody = await req.json();
    const { space_slug, title, body_md, actions, voting_window_hours } = proposalSchema.parse(rawBody);

    // Get space
    const { data: space, error: spaceError } = await supabase
      .from("dao_spaces")
      .select("*")
      .eq("slug", space_slug || "aicis-core")
      .single();

    if (spaceError) throw spaceError;

    const now = new Date();
    const windowHours = voting_window_hours || 72;
    const votingEnds = new Date(now.getTime() + windowHours * 3600000);

    // Create proposal
    const { data: proposal, error: proposalError } = await supabase
      .from("dao_proposals")
      .insert({
        space_id: space.id,
        created_by: user.id,
        title,
        body_md,
        status: "active",
        voting_starts: now.toISOString(),
        voting_ends: votingEnds.toISOString(),
        snapshot_at: now.toISOString(),
        actions: actions || [],
      })
      .select()
      .single();

    if (proposalError) throw proposalError;

    // Trigger snapshot
    await supabase.functions.invoke("dao-snapshot", {
      body: { space_slug: space.slug },
    });

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "dao_propose",
      user_id: user.id,
      log_level: "info",
      result: `Proposal created: ${title}`,
      metadata: { proposal_id: proposal.id },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "dao_propose",
      division: "governance",
      user_id: user.id,
      action_description: "Created DAO proposal",
      compliance_status: "compliant",
      data_accessed: { proposal_id: proposal.id, title },
    });

    return new Response(
      JSON.stringify({ ok: true, proposal }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in dao-propose:", e);
    
    // Handle validation errors
    if (e instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid proposal data",
          details: e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
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
