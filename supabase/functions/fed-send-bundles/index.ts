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
    console.log("Sending federation bundles...");

    // Get queued bundles
    const { data: bundles } = await supabase
      .from("federation_outbound_queue")
      .select("*")
      .eq("status", "queued")
      .order("window_start", { ascending: true });

    if (!bundles || bundles.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No queued bundles" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get enabled peers
    const { data: peers } = await supabase
      .from("federation_peers")
      .select("*")
      .eq("send_enabled", true);

    if (!peers || peers.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No enabled peers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let sentCount = 0;
    let errorCount = 0;

    // Send each bundle to each peer
    for (const bundle of bundles) {
      for (const peer of peers) {
        try {
          // In production, sign the payload here with AICIS_SIGNING_KEY_PEM
          const signature = "mock-signature"; // TODO: implement Ed25519/RSA-PSS signing

          const response = await fetch(`${peer.base_url}/fed-ingest`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-AICIS-Node": "aicis-node-1", // TODO: get from env
              "X-AICIS-Signature": signature,
              "Content-SHA256": bundle.hash
            },
            body: JSON.stringify(bundle.payload)
          });

          if (response.ok) {
            sentCount++;
            
            // Update peer last_seen
            await supabase
              .from("federation_peers")
              .update({ last_seen: new Date().toISOString() })
              .eq("id", peer.id);
          } else {
            errorCount++;
            console.error(`Failed to send to ${peer.peer_name}:`, await response.text());
          }
        } catch (error) {
          errorCount++;
          console.error(`Error sending to ${peer.peer_name}:`, error);
        }
      }

      // Mark bundle as sent
      await supabase
        .from("federation_outbound_queue")
        .update({
          status: errorCount === 0 ? "sent" : "failed",
          attempts: bundle.attempts + 1,
          last_attempt: new Date().toISOString()
        })
        .eq("id", bundle.id);
    }

    await supabase.from("system_logs").insert({
      action: "fed_send_bundles",
      result: `Sent ${sentCount} bundles, ${errorCount} errors`,
      log_level: "info",
      division: "system",
      metadata: { sent: sentCount, errors: errorCount }
    });

    console.log(`Sent ${sentCount} bundles, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ ok: true, sent: sentCount, errors: errorCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error sending bundles:", error);
    
    await supabase.from("system_logs").insert({
      action: "fed_send_bundles",
      result: `Error: ${errorMessage}`,
      log_level: "error",
      division: "system"
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
