import { Badge } from "@/components/ui/badge";
import { FlaskConical, BarChart3, Lightbulb } from "lucide-react";

interface EvidenceFilterProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  counts: { all: number; hypothetical: number; pilot: number; measured: number };
}

const filters = [
  { key: "all", label: "All", icon: null },
  { key: "hypothetical", label: "Hypothetical", icon: Lightbulb },
  { key: "pilot", label: "Pilot", icon: FlaskConical },
  { key: "measured", label: "Measured", icon: BarChart3 },
] as const;

const EvidenceFilter = ({ activeFilter, onFilterChange, counts }: EvidenceFilterProps) => (
  <div className="flex gap-2 flex-wrap">
    {filters.map(({ key, label, icon: Icon }) => (
      <button
        key={key}
        onClick={() => onFilterChange(key)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
          activeFilter === key
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
        }`}
      >
        {Icon && <Icon className="h-3 w-3" />}
        {label}
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1 h-4">
          {counts[key as keyof typeof counts]}
        </Badge>
      </button>
    ))}
  </div>
);

export default EvidenceFilter;
