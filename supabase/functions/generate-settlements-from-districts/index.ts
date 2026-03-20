import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FN = "generate-settlements-from-districts";
const SETTLEMENTS_PER_DISTRICT = 3;
const BATCH_SIZE = 50; // districts per invocation

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  try {
    // Use RPC to find parent regions without village children
    const { data: uncoveredDistricts, error: distErr } = await supabase
      .rpc("get_districts_needing_settlements", { _limit: BATCH_SIZE });

    if (distErr) throw distErr;

    if (!uncoveredDistricts || uncoveredDistricts.length === 0) {
      return new Response(JSON.stringify({
        success: true, message: "All districts have settlements!", remaining: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const districtIds = uncoveredDistricts.map((d: any) => d.id);
    const { data: existingChildren } = await supabase
      .from("admin_regions")
      .select("parent_id")
      .in("parent_id", districtIds)
      .gte("admin_level", 3);

    const parentsWithChildren = new Set((existingChildren || []).map(c => c.parent_id));
    const uncoveredDistricts = districts.filter(d => !parentsWithChildren.has(d.id));

    if (uncoveredDistricts.length === 0) {
      // All districts in this batch already have children — skip forward
      // Check total remaining
      const { count } = await supabase
        .from("admin_regions")
        .select("id", { count: "exact", head: true })
        .in("admin_level", [1, 2])
        .not("lat", "is", null);

      return new Response(JSON.stringify({
        success: true, message: "Batch already covered, checking next...",
        batch_covered: districts.length, total_parent_regions: count,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let created = 0;
    const errors: string[] = [];

    for (const district of uncoveredDistricts) {
      try {
        const settlements = generateSettlements(district);
        for (const s of settlements) {
          const { error } = await supabase.from("admin_regions").insert(s);
          if (!error) created++;
          else if (!error.message.includes("duplicate")) {
            errors.push(`${s.name}: ${error.message}`);
          }
        }
      } catch (e) {
        errors.push(`${district.name}: ${(e as Error).message}`);
      }
    }

    // Count remaining districts without village children
    const { count: totalDistricts } = await supabase
      .from("admin_regions")
      .select("id", { count: "exact", head: true })
      .in("admin_level", [1, 2])
      .not("lat", "is", null);

    const remaining = (totalDistricts || 0) - (parentsWithChildren.size + uncoveredDistricts.length);

    await supabase.from("automation_logs").insert({
      job_name: FN,
      status: errors.length > 0 ? "partial" : "success",
      message: `Created ${created} settlements from ${uncoveredDistricts.length} districts. Remaining ~${remaining}`,
    });

    // Self-chain if more work
    if (remaining > 0) {
      setTimeout(() => {
        fetch(`${supabaseUrl}/functions/v1/${FN}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: "{}",
        }).catch(() => {});
      }, 3000);
    }

    return new Response(JSON.stringify({
      success: true,
      created,
      processed_districts: uncoveredDistricts.length,
      remaining,
      errors: errors.slice(0, 5),
      auto_continuing: remaining > 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[${FN}] Error:`, e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateSettlements(district: any) {
  const { id, name, lat, lon, country_iso3, population_est } = district;
  const settlements: any[] = [];
  
  // Generate deterministic offsets based on district coordinates
  const offsets = [
    { dlat: 0.02, dlon: 0.015, suffix: "Central", urban: "urban" },
    { dlat: -0.035, dlon: 0.04, suffix: "North", urban: "rural" },
    { dlat: 0.04, dlon: -0.03, suffix: "South", urban: "rural" },
  ];

  const popBase = population_est || 15000;

  for (let i = 0; i < SETTLEMENTS_PER_DISTRICT; i++) {
    const o = offsets[i];
    // Add coordinate-seeded variation
    const jitterLat = Math.sin(lat * 1000 + i * 137) * 0.01;
    const jitterLon = Math.cos(lon * 1000 + i * 251) * 0.01;
    
    const sLat = Math.round((lat + o.dlat + jitterLat) * 100000) / 100000;
    const sLon = Math.round((lon + o.dlon + jitterLon) * 100000) / 100000;
    const sPop = Math.round(popBase / (3 + i) * (0.8 + Math.abs(Math.sin(lat + lon + i)) * 0.4));

    settlements.push({
      name: `${name} ${o.suffix}`,
      admin_level: 4,
      parent_id: id,
      country_iso3,
      lat: sLat,
      lon: sLon,
      population_est: sPop,
      urban_rural: o.urban,
      source: "district_derived",
      metadata: { derived_from: id, offset_index: i },
    });
  }

  return settlements;
}
