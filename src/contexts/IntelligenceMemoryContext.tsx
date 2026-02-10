/**
 * Intelligence Memory Context
 * Global cross-page intelligence coherence layer.
 * Stores, surfaces, and escalates signals across all views.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface IntelligenceSignal {
  id: string;
  signal_type: "cross_domain" | "confidence_drop" | "scenario_divergence" | "escalation" | "anomaly_correlation";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  domains: string[];
  countries: string[];
  source_pages: string[];
  confidence: number;
  evidence: Array<{ source: string; detail: string; timestamp?: string }>;
  escalation_reason: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IntelligenceMemoryContextType {
  signals: IntelligenceSignal[];
  activeSignals: IntelligenceSignal[];
  criticalSignals: IntelligenceSignal[];
  isLoading: boolean;
  addSignal: (signal: Omit<IntelligenceSignal, "id" | "acknowledged" | "acknowledged_by" | "acknowledged_at" | "created_at" | "updated_at">) => Promise<void>;
  acknowledgeSignal: (id: string) => Promise<void>;
  getSignalsForDomain: (domain: string) => IntelligenceSignal[];
  getSignalsForCountry: (iso3: string) => IntelligenceSignal[];
  getSignalsForPage: (page: string) => IntelligenceSignal[];
  unacknowledgedCount: number;
}

const IntelligenceMemoryContext = createContext<IntelligenceMemoryContextType | null>(null);

export const useIntelligenceMemory = () => {
  const ctx = useContext(IntelligenceMemoryContext);
  if (!ctx) throw new Error("useIntelligenceMemory must be used within IntelligenceMemoryProvider");
  return ctx;
};

export const IntelligenceMemoryProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [signals, setSignals] = useState<IntelligenceSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch signals
  const fetchSignals = useCallback(async () => {
    const { data, error } = await supabase
      .from("intelligence_signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      setSignals(data as unknown as IntelligenceSignal[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (user) fetchSignals();
  }, [user, fetchSignals]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("intelligence-signals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "intelligence_signals" }, () => {
        fetchSignals();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSignals]);

  const activeSignals = signals.filter(s => !s.acknowledged && (!s.expires_at || new Date(s.expires_at) > new Date()));
  const criticalSignals = activeSignals.filter(s => s.severity === "critical" || s.severity === "high");
  const unacknowledgedCount = activeSignals.length;

  const addSignal = useCallback(async (signal: Omit<IntelligenceSignal, "id" | "acknowledged" | "acknowledged_by" | "acknowledged_at" | "created_at" | "updated_at">) => {
    await supabase.from("intelligence_signals").insert({
      signal_type: signal.signal_type,
      severity: signal.severity,
      title: signal.title,
      description: signal.description,
      domains: signal.domains,
      countries: signal.countries,
      source_pages: signal.source_pages,
      confidence: signal.confidence,
      evidence: signal.evidence as any,
      escalation_reason: signal.escalation_reason,
      expires_at: signal.expires_at,
    });
  }, []);

  const acknowledgeSignal = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from("intelligence_signals").update({
      acknowledged: true,
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    }).eq("id", id);
  }, [user]);

  const getSignalsForDomain = useCallback((domain: string) =>
    activeSignals.filter(s => s.domains.includes(domain)), [activeSignals]);

  const getSignalsForCountry = useCallback((iso3: string) =>
    activeSignals.filter(s => s.countries.includes(iso3)), [activeSignals]);

  const getSignalsForPage = useCallback((page: string) =>
    activeSignals.filter(s => s.source_pages.includes(page)), [activeSignals]);

  return (
    <IntelligenceMemoryContext.Provider value={{
      signals, activeSignals, criticalSignals, isLoading,
      addSignal, acknowledgeSignal,
      getSignalsForDomain, getSignalsForCountry, getSignalsForPage,
      unacknowledgedCount,
    }}>
      {children}
    </IntelligenceMemoryContext.Provider>
  );
};
