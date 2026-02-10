/**
 * Cross-Domain Signal Detection Hook
 * Detects correlated risks across domains and generates intelligence signals.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIntelligenceMemory } from "@/contexts/IntelligenceMemoryContext";

interface DomainRisk {
  domain: string;
  country: string;
  severity: number; // 0-100
  source: string;
}

const DETECTION_INTERVAL = 120_000; // 2 minutes

export const useCrossDomainDetection = () => {
  const { addSignal, signals } = useIntelligenceMemory();
  const lastRunRef = useRef(0);

  useEffect(() => {
    const detect = async () => {
      const now = Date.now();
      if (now - lastRunRef.current < DETECTION_INTERVAL) return;
      lastRunRef.current = now;

      try {
        // Gather risk indicators from multiple tables in parallel
        const [crises, alerts, security, health] = await Promise.all([
          supabase.from("crisis_events").select("region, kind, severity, status").eq("status", "active").limit(50),
          supabase.from("alerts").select("country, division, severity, title").eq("acknowledged", false).limit(50),
          supabase.from("security_incidents").select("country, severity, event_type, title").limit(30),
          supabase.from("health_data").select("region, severity_index, risk_level").limit(50),
        ]);

        // Build country → domain risk map
        const countryRisks = new Map<string, DomainRisk[]>();
        const addRisk = (r: DomainRisk) => {
          const existing = countryRisks.get(r.country) || [];
          existing.push(r);
          countryRisks.set(r.country, existing);
        };

        crises.data?.forEach(c => {
          if (c.severity && c.severity >= 7) {
            addRisk({ domain: "crisis", country: c.region, severity: c.severity * 10, source: "crisis_events" });
          }
        });

        alerts.data?.forEach(a => {
          if (a.country && (a.severity === "critical" || a.severity === "high")) {
            addRisk({ domain: a.division, country: a.country, severity: a.severity === "critical" ? 90 : 70, source: "alerts" });
          }
        });

        security.data?.forEach(s => {
          if (s.country && s.severity && s.severity >= 7) {
            addRisk({ domain: "security", country: s.country, severity: s.severity * 10, source: "security_incidents" });
          }
        });

        health.data?.forEach(h => {
          if (h.region && h.severity_index && h.severity_index > 70) {
            addRisk({ domain: "health", country: h.region, severity: h.severity_index, source: "health_data" });
          }
        });

        // Detect cross-domain correlations (same country, 2+ domains)
        const recentSignalTitles = new Set(signals.slice(0, 50).map(s => s.title));

        for (const [country, risks] of countryRisks) {
          const uniqueDomains = [...new Set(risks.map(r => r.domain))];
          if (uniqueDomains.length >= 2) {
            const avgSeverity = risks.reduce((s, r) => s + r.severity, 0) / risks.length;
            const title = `Multi-domain risk: ${country} (${uniqueDomains.join(", ")})`;

            // Skip if already generated recently
            if (recentSignalTitles.has(title)) continue;

            const severity = avgSeverity >= 80 ? "critical" : avgSeverity >= 60 ? "high" : avgSeverity >= 40 ? "medium" : "low";
            const confidence = Math.min(95, Math.round(40 + uniqueDomains.length * 12 + avgSeverity * 0.2));

            await addSignal({
              signal_type: "cross_domain",
              severity: severity as any,
              title,
              description: `${country} shows elevated risk across ${uniqueDomains.length} domains: ${uniqueDomains.join(", ")}. Average severity: ${Math.round(avgSeverity)}%.`,
              domains: uniqueDomains,
              countries: [country],
              source_pages: ["dashboard", "security", "health"],
              confidence,
              evidence: risks.map(r => ({
                source: r.source,
                detail: `${r.domain}: severity ${r.severity}%`,
                timestamp: new Date().toISOString(),
              })),
              escalation_reason: avgSeverity >= 70 ? `High cross-domain correlation (${uniqueDomains.length} domains, avg severity ${Math.round(avgSeverity)}%)` : null,
              expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            });
          }
        }
      } catch (err) {
        console.warn("Cross-domain detection error:", err);
      }
    };

    detect();
    const interval = setInterval(detect, DETECTION_INTERVAL);
    return () => clearInterval(interval);
  }, [addSignal, signals]);
};
