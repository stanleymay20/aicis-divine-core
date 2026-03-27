import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PanelSkeletonProps {
  /** Number of skeleton rows */
  rows?: number;
  /** Show header skeleton */
  header?: boolean;
  /** Additional class name */
  className?: string;
  /** Variant for different panel types */
  variant?: "table" | "metrics" | "list" | "chart";
}

export function PanelSkeleton({ rows = 4, header = true, className, variant = "list" }: PanelSkeletonProps) {
  return (
    <Card className={cn("border-border/50", className)}>
      {header && (
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {variant === "metrics" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-2 rounded bg-muted/30 space-y-1.5">
                <Skeleton className="h-5 w-10 mx-auto" />
                <Skeleton className="h-2.5 w-16 mx-auto" />
              </div>
            ))}
          </div>
        )}
        {variant === "table" && (
          <div className="space-y-1.5">
            <div className="flex gap-3 px-2 pb-1 border-b border-border/30">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-2.5 w-12 flex-1" />
              ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex gap-3 px-2 py-1.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-3.5 flex-1" />
                ))}
              </div>
            ))}
          </div>
        )}
        {variant === "list" && (
          <div className="space-y-2.5">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border/30">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-3.5 w-8" />
              </div>
            ))}
          </div>
        )}
        {variant === "chart" && (
          <div className="space-y-2">
            <Skeleton className="h-[200px] w-full rounded" />
            <div className="flex gap-4 justify-center">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-2.5 w-16" />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Inline metric placeholder */
export function MetricSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-2 rounded bg-muted/30 space-y-1.5", className)}>
      <Skeleton className="h-5 w-10 mx-auto" />
      <Skeleton className="h-2.5 w-16 mx-auto" />
    </div>
  );
}
