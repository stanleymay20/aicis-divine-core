import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GlobalSignal = {
  id: string;
  title: string;
  summary: string;
  normalized_summary: string | null;
  category: string;
  subcategory: string | null;
  status: string;
  confidence_score: number;
  impact_score: number;
  urgency_score: number;
  source_count: number;
  primary_source: string | null;
  source_references: any[];
  first_detected_at: string;
  latest_update_at: string;
  occurred_at: string | null;
  affected_regions: string[];
  affected_countries: string[];
  affected_sectors: string[];
  affected_stakeholders: string[];
  strategic_implications: string | null;
  likely_consequences: string | null;
  uncertainty_notes: string | null;
  misinformation_risk: number;
  recommended_actions: Record<string, string>;
  audience_framing: Record<string, string>;
  impact_reasoning: string | null;
  evidence_hash: string | null;
  model_version: string | null;
  ingestion_source: string | null;
  created_at: string;
};

export function useGlobalSignals(options?: {
  category?: string;
  limit?: number;
  minImpact?: number;
}) {
  return useQuery({
    queryKey: ["global-signals", options],
    queryFn: async () => {
      let query = supabase
        .from("global_signals")
        .select("*")
        .order("first_detected_at", { ascending: false })
        .limit(options?.limit || 50);

      if (options?.category) {
        query = query.eq("category", options.category);
      }
      if (options?.minImpact) {
        query = query.gte("impact_score", options.minImpact);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as GlobalSignal[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useTopSignals(limit = 5) {
  return useQuery({
    queryKey: ["top-signals", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_signals")
        .select("*")
        .gte("impact_score", 50)
        .order("impact_score", { ascending: false })
        .order("urgency_score", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as GlobalSignal[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
