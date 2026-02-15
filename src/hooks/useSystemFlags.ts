/**
 * Runtime feature flag system — reads from system_flags table.
 * Replaces import-time engine selection with database-driven flags.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SystemFlags {
  use_v2_engine: boolean;
  enable_structural_break_detection: boolean;
  enable_fragility_model: boolean;
  enable_fan_charts: boolean;
  enable_signal_prioritization: boolean;
  [key: string]: boolean;
}

const DEFAULT_FLAGS: SystemFlags = {
  use_v2_engine: true,
  enable_structural_break_detection: true,
  enable_fragility_model: true,
  enable_fan_charts: true,
  enable_signal_prioritization: true,
};

export function useSystemFlags() {
  const { data: flags = DEFAULT_FLAGS, isLoading } = useQuery({
    queryKey: ["system-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_flags")
        .select("flag_key, enabled");

      if (error || !data) return DEFAULT_FLAGS;

      const result = { ...DEFAULT_FLAGS };
      for (const row of data) {
        if (row.flag_key in result) {
          result[row.flag_key] = row.enabled;
        }
      }
      return result;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return { flags, isLoading };
}
