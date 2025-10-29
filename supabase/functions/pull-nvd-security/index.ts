import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    // Use service role for system operations (cron jobs)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const apiKey = Deno.env.get("NVD_API_KEY");
    if (!apiKey) throw new Error("NVD API key not configured");

    console.log("Fetching vulnerability data from NVD...");

    // Calculate date 7 days ago for recent vulnerabilities
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    // Fetch recent CVEs
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${startDate}T00:00:00.000&pubEndDate=${endDate}T23:59:59.999&resultsPerPage=50`;
    
    const response = await fetch(url, {
      headers: {
        'apiKey': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`NVD API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`Fetched ${data.totalResults} vulnerabilities from NVD`);

    const records = [];

    if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
      for (const vuln of data.vulnerabilities) {
        const cve = vuln.cve;
        
        // Extract CVSS score
        let cvssScore = null;
        let severity = 'UNKNOWN';
        
        if (cve.metrics) {
          if (cve.metrics.cvssMetricV31 && cve.metrics.cvssMetricV31.length > 0) {
            cvssScore = cve.metrics.cvssMetricV31[0].cvssData.baseScore;
            severity = cve.metrics.cvssMetricV31[0].cvssData.baseSeverity;
          } else if (cve.metrics.cvssMetricV30 && cve.metrics.cvssMetricV30.length > 0) {
            cvssScore = cve.metrics.cvssMetricV30[0].cvssData.baseScore;
            severity = cve.metrics.cvssMetricV30[0].cvssData.baseSeverity;
          } else if (cve.metrics.cvssMetricV2 && cve.metrics.cvssMetricV2.length > 0) {
            cvssScore = cve.metrics.cvssMetricV2[0].cvssData.baseScore;
            severity = cve.metrics.cvssMetricV2[0].baseSeverity || 'MEDIUM';
          }
        }

        // Extract description
        let description = 'No description available';
        if (cve.descriptions && cve.descriptions.length > 0) {
          description = cve.descriptions[0].value;
        }

        // Extract affected products
        const affectedProducts = [];
        if (cve.configurations && cve.configurations.length > 0) {
          for (const config of cve.configurations) {
            if (config.nodes) {
              for (const node of config.nodes) {
                if (node.cpeMatch) {
                  for (const match of node.cpeMatch) {
                    if (match.criteria) {
                      affectedProducts.push(match.criteria);
                    }
                  }
                }
              }
            }
          }
        }

        // Extract references
        const referenceLinks = [];
        if (cve.references && cve.references.length > 0) {
          for (const ref of cve.references) {
            referenceLinks.push({
              url: ref.url,
              source: ref.source,
              tags: ref.tags || []
            });
          }
        }

        records.push({
          cve_id: cve.id,
          description: description.substring(0, 5000), // Limit description length
          severity: severity,
          cvss_score: cvssScore,
          published_date: cve.published,
          last_modified: cve.lastModified,
          affected_products: affectedProducts.slice(0, 50), // Limit array size
          reference_links: referenceLinks
        });
      }
    }

    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from('security_vulnerabilities')
        .upsert(records, {
          onConflict: 'cve_id',
          ignoreDuplicates: false
        });

      if (insertError) throw insertError;
    }

    await supabase.from('system_logs').insert({
      source: 'nvd',
      level: 'info',
      message: `Successfully fetched ${records.length} security vulnerabilities`,
      metadata: { 
        records_count: records.length,
        total_available: data.totalResults,
        date_range: `${startDate} to ${endDate}`
      }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Fetched ${records.length} security vulnerabilities from last 7 days`,
        data: records.slice(0, 10) // Return first 10 for preview
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pull-nvd-security error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
