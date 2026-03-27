import { type ReactNode } from "react";
import { type UseQueryResult } from "@tanstack/react-query";
import { ErrorBoundary } from "./error-boundary";
import { PanelSkeleton } from "./panel-skeleton";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";

interface QueryPanelProps<T> {
  query: UseQueryResult<T, Error>;
  children: (data: T) => ReactNode;
  /** Skeleton variant */
  skeleton?: "table" | "metrics" | "list" | "chart";
  /** Number of skeleton rows */
  skeletonRows?: number;
  /** Custom empty state */
  emptyMessage?: string;
  /** Check if data is "empty" even when query succeeds */
  isEmpty?: (data: T) => boolean;
}

/**
 * Enterprise-grade query wrapper that handles loading, error, and empty states
 * with proper error boundaries and skeleton UIs.
 */
export function QueryPanel<T>({
  query,
  children,
  skeleton = "list",
  skeletonRows = 4,
  emptyMessage = "No data available",
  isEmpty,
}: QueryPanelProps<T>) {
  return (
    <ErrorBoundary compact>
      <QueryPanelInner
        query={query}
        skeleton={skeleton}
        skeletonRows={skeletonRows}
        emptyMessage={emptyMessage}
        isEmpty={isEmpty}
      >
        {children}
      </QueryPanelInner>
    </ErrorBoundary>
  );
}

function QueryPanelInner<T>({
  query,
  children,
  skeleton,
  skeletonRows,
  emptyMessage,
  isEmpty,
}: QueryPanelProps<T>) {
  if (query.isLoading) {
    return <PanelSkeleton variant={skeleton} rows={skeletonRows} header={false} />;
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-destructive/20 bg-destructive/5 text-center min-h-[120px]">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <p className="text-xs text-muted-foreground">
          {query.error?.message || "Failed to load data"}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px]"
          onClick={() => query.refetch()}
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  if (!query.data || (isEmpty && isEmpty(query.data))) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 p-6 text-center min-h-[100px]">
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children(query.data)}</>;
}
