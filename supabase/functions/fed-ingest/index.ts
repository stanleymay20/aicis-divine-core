import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-aicis-node, x-aicis-signature, content-sha256",
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
    const peerName = req.headers.get("X-AICIS-Node");
    const signature = req.headers.get("X-AICIS-Signature");
    const contentHash = req.headers.get("Content-SHA256");

    if (!peerName || !signature || !contentHash) {
      return new Response(JSON.stringify({ error: "Missing required headers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Find peer
    const { data: peer } = await supabase
      .from("federation_peers")
      .select("*")
      .eq("peer_name", peerName)
      .eq("recv_enabled", true)
      .single();

    if (!peer) {
      return new Response(JSON.stringify({ error: "Unknown or disabled peer" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payload = await req.json();

    // TODO: Verify signature with peer.pubkey_pem
    // For now, mock verification
    const signatureValid = true;

    // Validate window
    const windowStart = new Date(payload.window_start);
    const windowEnd = new Date(payload.window_end);
    const now = new Date();
    const clockSkew = Math.abs(now.getTime() - windowEnd.getTime());

    if (clockSkew > 10 * 60 * 1000) { // 10 minutes
      return new Response(JSON.stringify({ error: "Clock skew too large" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Compute summary strength
    const nodeReliability = payload.node_reliability || 0.5;
    const avgSampleSize = payload.signals.reduce((sum: number, s: any) => sum + s.sample_size, 0) / payload.signals.length;
    const summaryStrength = (peer.trust_score / 100) * nodeReliability * Math.min(1, avgSampleSize / 100);

    // Insert inbound signal
    const { error: insertError } = await supabase
      .from("federation_inbound_signals")
      .insert({
        peer_id: peer.id,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        signals: payload.signals,
        signature_valid: signatureValid,
        peer_trust: peer.trust_score,
        summary_strength: summaryStrength
      });

    if (insertError) throw insertError;

    await supabase.from("system_logs").insert({
      action: "fed_ingest",
      result: `Ingested bundle from ${peerName} with ${payload.signals.length} signals`,
      log_level: "info",
      division: "system",
      metadata: { peer: peerName, signals: payload.signals.length }
    });

    console.log(`Ingested bundle from ${peerName}`);

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error ingesting bundle:", error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
