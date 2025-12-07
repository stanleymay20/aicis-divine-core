import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, Focus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MiniMapProps {
  mainMap: maplibregl.Map | null;
  className?: string;
}

export const MiniMap = ({ mainMap, className }: MiniMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const miniMap = useRef<maplibregl.Map | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || miniMap.current) return;

    miniMap.current = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "simple-tiles": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: "simple-tiles",
            type: "raster",
            source: "simple-tiles",
            minzoom: 0,
            maxzoom: 10,
          },
        ],
      },
      center: [0, 20],
      zoom: 0.5,
      interactive: false,
      attributionControl: false,
    });

    return () => {
      miniMap.current?.remove();
      miniMap.current = null;
    };
  }, []);

  // Sync with main map
  useEffect(() => {
    if (!mainMap || !miniMap.current) return;

    const syncMiniMap = () => {
      if (!mainMap || !miniMap.current) return;
      const center = mainMap.getCenter();
      const zoom = Math.max(0, mainMap.getZoom() - 3);
      miniMap.current.setCenter(center);
      miniMap.current.setZoom(zoom);
    };

    mainMap.on("move", syncMiniMap);
    mainMap.on("zoom", syncMiniMap);

    return () => {
      mainMap.off("move", syncMiniMap);
      mainMap.off("zoom", syncMiniMap);
    };
  }, [mainMap]);

  const resetMainMap = () => {
    mainMap?.flyTo({
      center: [0, 20],
      zoom: 2,
      duration: 1500,
    });
  };

  return (
    <div
      className={cn(
        "absolute bottom-28 left-4 z-20 bg-card/90 backdrop-blur-sm border border-primary/20 rounded-lg overflow-hidden transition-all duration-300",
        isExpanded ? "w-72 h-48" : "w-36 h-24",
        className
      )}
    >
      {/* Map container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Viewport indicator */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-4 border-2 border-primary/40 rounded-sm" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_hsl(var(--primary))]" />
      </div>

      {/* Controls */}
      <div className="absolute top-1 right-1 flex gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/50 hover:bg-background/80"
          onClick={resetMainMap}
        >
          <Focus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/50 hover:bg-background/80"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <Minimize2 className="h-3 w-3" />
          ) : (
            <Maximize2 className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Label */}
      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-background/70 rounded text-[9px] font-orbitron text-muted-foreground">
        OVERVIEW
      </div>
    </div>
  );
};
