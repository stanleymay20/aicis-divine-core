import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, TrendingUp, Clock, Globe, ExternalLink,
  Shield, Zap, FileText, Plus, Eye, ArrowRight, X
} from "lucide-react";
import type { GlobalSignal } from "@/hooks/useGlobalSignals";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AudienceMode = "government" | "media" | "business" | "public";

function scoreBar(score: number, label: string) {
  const color = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-amber-500" : score >= 40 ? "bg-yellow-500" : "bg-muted-foreground";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold">{score}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function SignalDetailPanel({
  signal,
  audienceMode,
  onClose,
}: {
  signal: GlobalSignal;
  audienceMode: AudienceMode;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const createDecision = async () => {
    const domain = signal.category === "public_health" ? "health" :
      signal.category === "defense_conflict" ? "security" :
      signal.category === "economic" || signal.category === "financial_markets" ? "economy" :
      signal.category === "energy" ? "energy" : "governance";

    const { error } = await supabase.from("decision_outcome_log").insert({
      decision_title: `[SIGNAL] ${signal.title}`,
      domain,
      action_taken: false,
      signal_source: "global_signal_engine",
      signal_id: signal.id,
      evidence_type: "hypothetical",
      acceptance_status: "pending",
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Decision created", description: "Routed to Decisions Inbox" });
    }
  };

  const audiences: AudienceMode[] = ["government", "media", "business", "public"];

  return (
    <Card className="h-full border-l flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-semibold">Signal Detail</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          <h2 className="text-base font-semibold leading-tight">{signal.title}</h2>

          <p className="text-xs text-muted-foreground">{signal.summary}</p>

          {/* Scores */}
          <div className="space-y-2">
            {scoreBar(signal.impact_score, "Impact")}
            {scoreBar(signal.confidence_score, "Confidence")}
            {scoreBar(signal.urgency_score, "Urgency")}
            {scoreBar(signal.misinformation_risk || 0, "Misinfo Risk")}
          </div>

          <Separator />

          {/* Strategic implications */}
          {signal.strategic_implications && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold flex items-center gap-1">
                <Zap className="h-3 w-3 text-primary" /> Why It Matters
              </h4>
              <p className="text-xs text-muted-foreground">{signal.strategic_implications}</p>
            </div>
          )}

          {signal.likely_consequences && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold flex items-center gap-1">
                <ArrowRight className="h-3 w-3 text-amber-500" /> Likely Consequences
              </h4>
              <p className="text-xs text-muted-foreground">{signal.likely_consequences}</p>
            </div>
          )}

          <Separator />

          {/* Audience-specific recommendations */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold">Recommended Actions by Audience</h4>
            {audiences.map(aud => {
              const action = signal.recommended_actions?.[aud];
              if (!action) return null;
              return (
                <div key={aud} className={cn(
                  "text-[11px] rounded px-2 py-1.5 border",
                  aud === audienceMode ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border/50"
                )}>
                  <span className="font-semibold capitalize">{aud}:</span>{" "}
                  <span className="text-foreground/80">{action}</span>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Affected */}
          <div className="space-y-2">
            {signal.affected_regions?.length > 0 && (
              <div>
                <h4 className="text-[10px] text-muted-foreground mb-1">Affected Regions</h4>
                <div className="flex flex-wrap gap-1">
                  {signal.affected_regions.map(r => (
                    <Badge key={r} variant="secondary" className="text-[9px] h-4">{r}</Badge>
                  ))}
                </div>
              </div>
            )}
            {signal.affected_countries?.length > 0 && (
              <div>
                <h4 className="text-[10px] text-muted-foreground mb-1">Countries</h4>
                <div className="flex flex-wrap gap-1">
                  {signal.affected_countries.map(c => (
                    <Badge key={c} variant="outline" className="text-[9px] h-4 font-mono">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
            {signal.affected_sectors?.length > 0 && (
              <div>
                <h4 className="text-[10px] text-muted-foreground mb-1">Sectors</h4>
                <div className="flex flex-wrap gap-1">
                  {signal.affected_sectors.map(s => (
                    <Badge key={s} variant="outline" className="text-[9px] h-4">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Sources */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold flex items-center gap-1">
              <FileText className="h-3 w-3" /> Sources
            </h4>
            {signal.source_references?.map((s: any, i: number) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                {s.name || "Source"} — {s.published ? new Date(s.published).toLocaleDateString() : ""}
              </a>
            ))}
          </div>

          {/* Audit */}
          <div className="text-[9px] text-muted-foreground/60 font-mono space-y-0.5">
            <div>Model: {signal.model_version || "—"}</div>
            <div>Hash: {signal.evidence_hash?.slice(0, 16) || "—"}…</div>
            <div>Source: {signal.ingestion_source || "—"}</div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-3 border-t space-y-2">
        <Button size="sm" className="w-full h-8 text-xs" onClick={createDecision}>
          <Plus className="h-3 w-3 mr-1" /> Create Decision
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px]">
            <Eye className="h-3 w-3 mr-1" /> Watchlist
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px]">
            <FileText className="h-3 w-3 mr-1" /> Add to Brief
          </Button>
        </div>
      </div>
    </Card>
  );
}
