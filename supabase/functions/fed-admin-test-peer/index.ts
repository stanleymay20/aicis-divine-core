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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { peer_id } = await req.json();

    if (!peer_id) {
      return new Response(JSON.stringify({ error: "peer_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get peer
    const { data: peer, error: peerError } = await supabase
      .from("federation_peers")
      .select("*")
      .eq("id", peer_id)
      .single();

    if (peerError || !peer) {
      return new Response(JSON.stringify({ error: "Peer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Test connection
    try {
      const response = await fetch(`${peer.base_url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });

      const reachable = response.ok;
      const message = reachable ? "Peer reachable" : `HTTP ${response.status}`;

      await supabase.from("system_logs").insert({
        action: "fed_test_peer",
        result: message,
        log_level: reachable ? "info" : "warn",
        division: "system",
        metadata: { peer: peer.peer_name, reachable }
      });

      return new Response(
        JSON.stringify({ ok: true, reachable, message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await supabase.from("system_logs").insert({
        action: "fed_test_peer",
        result: `Connection failed: ${errorMessage}`,
        log_level: "error",
        division: "system",
        metadata: { peer: peer.peer_name }
      });

      return new Response(
        JSON.stringify({ ok: false, reachable: false, message: errorMessage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error testing peer:", error);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
