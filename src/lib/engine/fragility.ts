/**
 * AICIS Engine — Systemic Fragility & Graph Propagation
 */
import type { DomainCoupling } from './types';

/**
 * Graph-based cross-domain fragility propagation.
 * Uses coupling matrix to model how shocks in one domain
 * propagate to others, creating compound systemic risk.
 */
export function computeSystemicFragilityV2(
  domainScores: Record<string, number>,
  couplingMatrix?: DomainCoupling[],
): number {
  const gov = (domainScores['governance'] ?? 50) / 100;
  const sec = (domainScores['security'] ?? 50) / 100;
  const fin = (domainScores['finance'] ?? 50) / 100;
  const baseFragility = (1 - gov) * (1 - sec) * (1 - fin);

  if (!couplingMatrix || couplingMatrix.length === 0) {
    return Math.round(baseFragility * 100 * 10) / 10;
  }

  let propagatedRisk = 0;
  const deficiencies: Record<string, number> = {};

  for (const [domain, score] of Object.entries(domainScores)) {
    const deficiency = Math.max(0, (50 - score) / 50);
    deficiencies[domain] = deficiency;
  }

  for (const coupling of couplingMatrix) {
    const sourceDeficiency = deficiencies[coupling.source_domain] || 0;
    if (sourceDeficiency <= 0.1) continue;

    const targetScore = (domainScores[coupling.target_domain] ?? 50) / 100;
    const targetVulnerability = 1 - targetScore;

    const shock = sourceDeficiency * coupling.coupling_weight * (0.5 + targetVulnerability * 0.5);
    propagatedRisk += shock;
  }

  const totalFragility = Math.min(1, baseFragility + propagatedRisk * 0.3);
  return Math.round(totalFragility * 100 * 10) / 10;
}

// Legacy alias
export function computeSystemicFragility(domainScores: Record<string, number>): number {
  return computeSystemicFragilityV2(domainScores);
}
