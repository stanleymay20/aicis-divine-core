import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, AlertTriangle, TrendingUp, 
  HelpCircle, CheckCircle, Info, Clock
} from "lucide-react";

interface NarrativeSection {
  type: "summary" | "drivers" | "risks" | "uncertainty" | "outlook";
  title?: string;
  content: string;
  confidence?: number;
  severity?: "low" | "medium" | "high" | "critical";
}

interface NarrativeSynthesisProps {
  title?: string;
  sections: NarrativeSection[];
  overallConfidence?: number;
  lastUpdated?: string;
  sources?: string[];
}

const getSectionIcon = (type: string) => {
  switch (type) {
    case "summary": return <BookOpen className="h-4 w-4" />;
    case "drivers": return <TrendingUp className="h-4 w-4" />;
    case "risks": return <AlertTriangle className="h-4 w-4" />;
    case "uncertainty": return <HelpCircle className="h-4 w-4" />;
    case "outlook": return <CheckCircle className="h-4 w-4" />;
    default: return <Info className="h-4 w-4" />;
  }
};

const getSectionColor = (type: string) => {
  switch (type) {
    case "summary": return "text-primary";
    case "drivers": return "text-primary";
    case "risks": return "text-warning";
    case "uncertainty": return "text-warning";
    case "outlook": return "text-success";
    default: return "text-muted-foreground";
  }
};

const getSeverityColor = (severity?: string) => {
  switch (severity) {
    case "critical": return "border-l-destructive";
    case "high": return "border-l-warning";
    case "medium": return "border-l-warning/60";
    default: return "border-l-success";
  }
};

const getDefaultTitle = (type: string) => {
  switch (type) {
    case "summary": return "Executive Summary";
    case "drivers": return "Key Drivers & Causality";
    case "risks": return "Risk Factors";
    case "uncertainty": return "Uncertainty & Limitations";
    case "outlook": return "Outlook & Recommendations";
    default: return "Analysis";
  }
};

export const NarrativeSynthesis = ({
  title,
  sections,
  overallConfidence,
  lastUpdated,
  sources
}: NarrativeSynthesisProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {title || "Intelligence Narrative"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {overallConfidence !== undefined && (
              <Badge variant="outline" className="gap-1">
                <Info className="h-3 w-3" />
                {Math.min(Math.round(overallConfidence * 100), 95)}% confidence
              </Badge>
            )}
            {lastUpdated && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {new Date(lastUpdated).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((section, idx) => (
          <div 
            key={idx}
            className={`
              pl-4 border-l-4 ${getSeverityColor(section.severity)}
              ${section.type === "uncertainty" ? "bg-warning/5 rounded-r-lg p-3" : ""}
            `}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={getSectionColor(section.type)}>
                {getSectionIcon(section.type)}
              </span>
              <h4 className="font-semibold text-sm">
                {section.title || getDefaultTitle(section.type)}
              </h4>
              {section.confidence !== undefined && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {Math.min(Math.round(section.confidence * 100), 95)}%
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {section.content}
            </p>
          </div>
        ))}

        <div className="mt-6 p-3 bg-muted/30 rounded-lg border border-dashed">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Uncertainty Notice</p>
              <p>
                All assessments are probabilistic and capped at 95% confidence. 
                This analysis is based on aggregate public data and should not be used 
                for individual-level decisions. Human review is required for any 
                consequential actions.
              </p>
            </div>
          </div>
        </div>

        {sources && sources.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Data Sources:</p>
            <div className="flex flex-wrap gap-1">
              {sources.map((source, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {source}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
