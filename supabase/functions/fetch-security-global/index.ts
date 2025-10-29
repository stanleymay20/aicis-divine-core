import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const ABUSEIPDB_KEY = Deno.env.get("ABUSEIPDB_API_KEY");
    const NVD_KEY = Deno.env.get("NVD_API_KEY");
    const VIRUSTOTAL_KEY = Deno.env.get("VIRUSTOTAL_API_KEY");
    const results = { security: 0, errors: [] };

    // NVD - Recent CVEs
    try {
      const nvdResponse = await fetch(
        `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20`,
        { headers: { 'apiKey': NVD_KEY || '' } }
      );
      const nvdData = await nvdResponse.json();
      
      if (nvdData.vulnerabilities) {
        const cveRecords = nvdData.vulnerabilities.map((v: any) => {
          const cve = v.cve;
          const severity = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || 
                          cve.metrics?.cvssMetricV2?.[0]?.baseSeverity || 'UNKNOWN';
          
          return {
            source: 'nvd',
            event_type: 'vulnerability',
            severity: severity.toLowerCase(),
            title: cve.id,
            description: cve.descriptions?.[0]?.value || 'No description',
            cve_id: cve.id,
            threat_score: Math.round((cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0) * 10),
            metadata: {
              published: cve.published,
              modified: cve.lastModified,
              references: cve.references?.slice(0, 3)
            }
          };
        });
        
        const { error } = await supabase.from('security_events').insert(cveRecords);
        if (!error) results.security += cveRecords.length;
      }
    } catch (e) {
      results.errors.push(`NVD: ${e.message}`);
    }

    // AbuseIPDB - Check known bad IPs
    try {
      const badIPs = ['8.8.8.8', '1.1.1.1', '185.220.101.1']; // Sample IPs
      
      for (const ip of badIPs) {
        const abuseResponse = await fetch(
          `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`,
          { headers: { 'Key': ABUSEIPDB_KEY || '', 'Accept': 'application/json' } }
        );
        const abuseData = await abuseResponse.json();
        
        if (abuseData.data && abuseData.data.abuseConfidenceScore > 20) {
          const { error } = await supabase.from('security_events').insert({
            source: 'abuseipdb',
            event_type: 'ip_abuse',
            severity: abuseData.data.abuseConfidenceScore > 80 ? 'critical' : 
                     abuseData.data.abuseConfidenceScore > 50 ? 'high' : 'medium',
            title: `Suspicious IP: ${ip}`,
            description: `Abuse confidence: ${abuseData.data.abuseConfidenceScore}%`,
            ip_address: ip,
            threat_score: abuseData.data.abuseConfidenceScore,
            metadata: {
              country: abuseData.data.countryCode,
              domain: abuseData.data.domain,
              total_reports: abuseData.data.totalReports
            }
          });
          if (!error) results.security++;
        }
      }
    } catch (e) {
      results.errors.push(`AbuseIPDB: ${e.message}`);
    }

    // Log completion
    await supabase.from('automation_logs').insert({
      job_name: 'fetch-security-global',
      status: results.errors.length === 0 ? 'success' : 'partial',
      message: `Fetched ${results.security} security events. Errors: ${results.errors.length}`
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Fetched ${results.security} security events`,
        data: results
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-security-global error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
