import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Layers, Globe, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_COUNTRIES, getCountryCoordinates, type Country } from "@/lib/geo/all-countries";
import { cn } from "@/lib/utils";

interface CountryData {
  country: string;
  iso3: string;
  latitude: number;
  longitude: number;
  overall_score?: number;
}

export interface GlobalMapRef {
  flyToCountry: (country: Country) => void;
  resetView: () => void;
  spinGlobe: () => void;
}

interface GlobalMapProps {
  onCountrySelect?: (country: CountryData) => void;
  className?: string;
}

export const GlobalMap = forwardRef<GlobalMapRef, GlobalMapProps>(
  ({ onCountrySelect, className }, ref) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [countryData, setCountryData] = useState<CountryData[]>([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
    const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch vulnerability data
    useEffect(() => {
      const fetchData = async () => {
        const { data } = await supabase
          .from("vulnerability_scores")
          .select("country, iso_code, latitude, longitude, overall_score")
          .order("calculated_at", { ascending: false });

        if (data) {
          const latestByCountry = data.reduce((acc: Record<string, CountryData>, curr) => {
            if (!acc[curr.country]) {
              acc[curr.country] = {
                country: curr.country,
                iso3: curr.iso_code || '',
                latitude: curr.latitude || 0,
                longitude: curr.longitude || 0,
                overall_score: curr.overall_score || undefined,
              };
            }
            return acc;
          }, {});
          setCountryData(Object.values(latestByCountry));
        }
      };
      fetchData();
    }, []);

    // Initialize map
    useEffect(() => {
      if (!mapContainer.current || map.current) return;

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: "raster",
              tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              ],
              tileSize: 256,
              attribution: "Esri, Maxar, Earthstar Geographics",
            },
          },
          layers: [
            {
              id: "satellite",
              type: "raster",
              source: "satellite",
              minzoom: 0,
              maxzoom: 19,
            },
          ],
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        },
        center: [0, 20],
        zoom: 2,
        pitch: 0,
        bearing: 0,
        maxZoom: 18,
        minZoom: 1,
      });

      map.current.on("load", () => {
        setMapLoaded(true);
      });

      return () => {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        map.current?.remove();
        map.current = null;
      };
    }, []);

    // Add markers
    useEffect(() => {
      if (!map.current || !mapLoaded || countryData.length === 0) return;

      document.querySelectorAll(".country-marker").forEach(m => m.remove());

      countryData.forEach(data => {
        if (!data.latitude || !data.longitude) return;

        const score = data.overall_score || 0;
        const color = score >= 80 ? "hsl(0 84% 60%)" :
                      score >= 60 ? "hsl(38 92% 50%)" :
                      score >= 40 ? "hsl(142 76% 55%)" : "hsl(142 76% 45%)";

        const el = document.createElement("div");
        el.className = "country-marker";
        const size = 12 + score / 8;
        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.8);
          box-shadow: 0 0 12px ${color};
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        `;

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.4)";
          el.style.boxShadow = `0 0 24px ${color}`;
        });

        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
          el.style.boxShadow = `0 0 12px ${color}`;
        });

        el.addEventListener("click", () => {
          setSelectedCountry(data);
          onCountrySelect?.(data);
          flyToLocation(data.longitude, data.latitude, 5);
        });

        new maplibregl.Marker({ element: el })
          .setLngLat([data.longitude, data.latitude])
          .addTo(map.current!);
      });
    }, [countryData, mapLoaded, onCountrySelect]);

    const flyToLocation = useCallback((lng: number, lat: number, zoom = 5) => {
      if (!map.current) return;
      map.current.flyTo({
        center: [lng, lat],
        zoom,
        duration: 2000,
        essential: true,
      });
    }, []);

    const spinGlobe = useCallback(() => {
      if (!map.current || isSpinning) return;
      
      setIsSpinning(true);
      map.current.flyTo({ center: [0, 20], zoom: 1.5, duration: 1000 });

      let rotation = 0;
      spinIntervalRef.current = setInterval(() => {
        rotation += 20;
        if (map.current) {
          map.current.setBearing(rotation % 360);
        }
      }, 50);

      setTimeout(() => {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        if (map.current) map.current.setBearing(0);
        setIsSpinning(false);
      }, 2500);
    }, [isSpinning]);

    const resetView = useCallback(() => {
      if (!map.current) return;
      map.current.flyTo({
        center: [0, 20],
        zoom: 2,
        bearing: 0,
        pitch: 0,
        duration: 1500,
      });
      setSelectedCountry(null);
    }, []);

    const flyToCountry = useCallback((country: Country) => {
      const coords = getCountryCoordinates(country.iso2);
      if (coords) {
        spinGlobe();
        setTimeout(() => {
          flyToLocation(coords.lng, coords.lat, 5);
          const vulnData = countryData.find(c =>
            c.country.toLowerCase().includes(country.name.toLowerCase())
          );
          const data: CountryData = {
            country: country.name,
            iso3: country.iso3,
            latitude: coords.lat,
            longitude: coords.lng,
            ...vulnData,
          };
          setSelectedCountry(data);
          onCountrySelect?.(data);
        }, 2500);
      }
    }, [countryData, flyToLocation, onCountrySelect, spinGlobe]);

    useImperativeHandle(ref, () => ({
      flyToCountry,
      resetView,
      spinGlobe,
    }));

    return (
      <div className={cn("relative w-full h-full", className)}>
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Spinning overlay */}
        {isSpinning && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <Globe className="w-16 h-16 text-primary animate-spin" style={{ animationDuration: "0.8s" }} />
              <span className="text-sm font-orbitron text-primary animate-pulse">
                Scanning globe...
              </span>
            </div>
          </div>
        )}

        {/* Map controls */}
        <div className="absolute bottom-24 left-4 flex flex-col gap-1 z-20">
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 bg-card/90 backdrop-blur-sm"
            onClick={() => map.current?.zoomIn()}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 bg-card/90 backdrop-blur-sm"
            onClick={() => map.current?.zoomOut()}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 bg-card/90 backdrop-blur-sm"
            onClick={resetView}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-24 right-4 p-3 bg-card/90 backdrop-blur-sm rounded-lg border border-primary/20 z-20">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-primary" />
            Risk Level
          </div>
          <div className="space-y-1">
            {[
              { color: "hsl(142 76% 45%)", label: "Low" },
              { color: "hsl(142 76% 55%)", label: "Medium" },
              { color: "hsl(38 92% 50%)", label: "High" },
              { color: "hsl(0 84% 60%)", label: "Critical" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected country popup */}
        {selectedCountry && !isSpinning && (
          <div className="absolute top-4 right-4 w-72 p-4 bg-card/95 backdrop-blur-sm rounded-lg border border-primary/20 z-20 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-orbitron font-bold">{selectedCountry.country}</h3>
              <Badge>{selectedCountry.iso3}</Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coordinates</span>
                <span className="font-mono text-xs">
                  {selectedCountry.latitude.toFixed(2)}, {selectedCountry.longitude.toFixed(2)}
                </span>
              </div>
              {selectedCountry.overall_score !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Risk Score</span>
                  <Badge variant={selectedCountry.overall_score >= 60 ? "destructive" : "default"}>
                    {selectedCountry.overall_score.toFixed(0)}/100
                  </Badge>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3"
              onClick={() => setSelectedCountry(null)}
            >
              Close
            </Button>
          </div>
        )}

        {/* Stats badge */}
        <div className="absolute top-4 left-4 z-20">
          <Badge variant="secondary" className="bg-card/90 backdrop-blur-sm border-primary/20">
            <Globe className="h-3 w-3 mr-1" />
            {ALL_COUNTRIES.length} countries • {countryData.length} monitored
          </Badge>
        </div>
      </div>
    );
  }
);

GlobalMap.displayName = "GlobalMap";
