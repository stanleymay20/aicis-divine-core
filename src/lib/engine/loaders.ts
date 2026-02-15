/**
 * AICIS Engine — Database Loaders
 */
import type { DomainCoupling, DomainModelParams, DomainPerformanceV2 } from './types';
import { DEFAULT_WEIGHTS, CURRENT_MODEL_VERSION } from './types';

export async function loadDomainWeightsFromDB(
  supabaseClient: any,
  modelVersion: string = CURRENT_MODEL_VERSION,
): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabaseClient
      .from("domain_weights")
      .select("domain, weight")
      .eq("model_version", modelVersion);
    if (error || !data || data.length === 0) return { ...DEFAULT_WEIGHTS };
    const weights: Record<string, number> = {};
    for (const row of data) weights[row.domain] = Number(row.weight);
    return weights;
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export async function loadCouplingMatrix(
  supabaseClient: any,
  modelVersion: string = CURRENT_MODEL_VERSION,
): Promise<DomainCoupling[]> {
  try {
    const { data, error } = await supabaseClient
      .from("domain_coupling_matrix")
      .select("source_domain, target_domain, coupling_weight, propagation_delay_days")
      .eq("model_version", modelVersion);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function archiveForecastSnapshot(
  supabaseClient: any,
  iso3: string,
  countryName: string,
  domain: DomainPerformanceV2,
  params: DomainModelParams,
  trainingWindowEnd?: string,
  calibrationVersion?: string,
): Promise<void> {
  try {
    await supabaseClient.from("forecast_archive").insert({
      iso3,
      country_name: countryName,
      domain: domain.domain,
      model_version: CURRENT_MODEL_VERSION,
      alpha: params.alpha,
      beta: params.beta,
      performance_index: domain.performanceIndex,
      forecast_90d: domain.forecast90d,
      forecast_1y: domain.forecast1y,
      forecast_upper_80: domain.forecastUpper80,
      forecast_lower_80: domain.forecastLower80,
      forecast_upper_95: domain.forecastUpper95,
      forecast_lower_95: domain.forecastLower95,
      confidence_score: domain.confidenceScore,
      stability_score: 0,
      structural_break_flag: domain.structuralBreak,
      structural_break_p_value: domain.structuralBreakPValue,
      data_stale_days: domain.dataStaleDays,
      data_quality_score: Math.max(0, 100 - domain.dataGapCount * 5 - domain.dataStaleDays * 0.5),
      gap_interpolation_count: domain.dataGapCount,
      training_window_end: trainingWindowEnd,
      calibration_version: calibrationVersion,
      parameter_set_id: `${params.alpha}_${params.beta}`,
    });
  } catch {
    // Non-critical
  }
}
