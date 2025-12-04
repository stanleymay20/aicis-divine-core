import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Globe, Loader2, MapPin, Layers, 
  ZoomIn, ZoomOut, RotateCcw, Satellite, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_COUNTRIES, searchCountries, getCountryCoordinates, type Country } from "@/lib/geo/all-countries";
import { useToast } from "@/hooks/use-toast";

interface CountryData {
  country: string;
  iso3: string;
  latitude: number;
  longitude: number;
  overall_score?: number;
  health_risk?: number;
  food_risk?: number;
  energy_risk?: number;
  climate_risk?: number;
  population_affected?: number;
}

export const SatelliteDashboard = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [searchResults, setSearchResults] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { toast } = useToast();

  // Fetch all vulnerability data
  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("vulnerability_scores")
        .select("*")
        .order("calculated_at", { ascending: false });

      if (data) {
        const latestByCountry = data.reduce((acc: Record<string, any>, curr) => {
          if (!acc[curr.country]) acc[curr.country] = curr;
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
          "satellite": {
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
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add markers when data loads
  useEffect(() => {
    if (!map.current || !mapLoaded || countryData.length === 0) return;

    // Clear existing markers
    document.querySelectorAll(".country-marker").forEach(m => m.remove());

    countryData.forEach(data => {
      if (!data.latitude || !data.longitude) return;

      const score = data.overall_score || 0;
      const color = score >= 80 ? "hsl(0 84% 60%)" : 
                    score >= 60 ? "hsl(38 92% 50%)" : 
                    score >= 40 ? "hsl(142 76% 55%)" : "hsl(142 76% 45%)";

      const el = document.createElement("div");
      el.className = "country-marker";
      el.style.cssText = `
        width: ${16 + score / 6}px;
        height: ${16 + score / 6}px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.8);
        box-shadow: 0 0 12px ${color};
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      `;

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.3)";
        el.style.boxShadow = `0 0 20px ${color}`;
      });

      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        el.style.boxShadow = `0 0 12px ${color}`;
      });

      el.addEventListener("click", () => {
        setSelectedCountry(data);
        flyToLocation(data.longitude, data.latitude, 5);
      });

      new maplibregl.Marker({ element: el })
        .setLngLat([data.longitude, data.latitude])
        .addTo(map.current!);
    });
  }, [countryData, mapLoaded]);

  const flyToLocation = useCallback((lng: number, lat: number, zoom: number = 5) => {
    if (!map.current) return;
    
    map.current.flyTo({
      center: [lng, lat],
      zoom,
      duration: 2000,
      essential: true,
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setIsSpinning(true);

    // Show spinning globe animation
    if (map.current) {
      map.current.flyTo({
        center: [0, 20],
        zoom: 1.5,
        duration: 1000,
      });

      // Spin animation
      let rotation = 0;
      const spinInterval = setInterval(() => {
        rotation += 15;
        if (map.current) {
          map.current.setBearing(rotation % 360);
        }
      }, 50);

      setTimeout(() => {
        clearInterval(spinInterval);
        if (map.current) map.current.setBearing(0);
        setIsSpinning(false);
      }, 2000);
    }

    // Search countries
    const results = searchCountries(searchQuery);
    setSearchResults(results.slice(0, 10));

    if (results.length > 0) {
      const country = results[0];
      const coords = getCountryCoordinates(country.iso2);
      
      if (coords) {
        // Fetch country data from database
        const { data } = await supabase
          .from("country_profiles")
          .select("*")
          .eq("iso3", country.iso3)
          .single();

        setTimeout(() => {
          flyToLocation(coords.lng, coords.lat, 5);
          
          // Find vulnerability data
          const vulnData = countryData.find(c => 
            c.country.toLowerCase().includes(country.name.toLowerCase())
          );

          setSelectedCountry({
            country: country.name,
            iso3: country.iso3,
            latitude: coords.lat,
            longitude: coords.lng,
            ...vulnData,
          });
        }, 2000);
      }
    } else {
      toast({
        title: "No results",
        description: `No countries found for "${searchQuery}"`,
        variant: "destructive",
      });
    }

    setIsSearching(false);
  }, [searchQuery, countryData, flyToLocation, toast]);

  const selectCountry = useCallback((country: Country) => {
    const coords = getCountryCoordinates(country.iso2);
    if (coords) {
      flyToLocation(coords.lng, coords.lat, 5);
      
      const vulnData = countryData.find(c => 
        c.country.toLowerCase().includes(country.name.toLowerCase())
      );

      setSelectedCountry({
        country: country.name,
        iso3: country.iso3,
        latitude: coords.lat,
        longitude: coords.lng,
        ...vulnData,
      });
    }
    setSearchResults([]);
    setSearchQuery("");
  }, [countryData, flyToLocation]);

  const resetView = () => {
    if (map.current) {
      map.current.flyTo({
        center: [0, 20],
        zoom: 2,
        bearing: 0,
        pitch: 0,
        duration: 1500,
      });
    }
    setSelectedCountry(null);
  };

  return (
    <div className="h-[calc(100vh-200px)] relative">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />

      {/* Spinning Globe Overlay */}
      {isSpinning && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <Globe className="w-24 h-24 text-primary animate-spin" style={{ animationDuration: "1s" }} />
            <span className="text-lg font-orbitron text-primary">Searching globally...</span>
          </div>
        </div>
      )}

      {/* Search Panel */}
      <Card className="absolute top-4 left-4 right-4 md:right-auto md:w-96 p-4 bg-card/95 backdrop-blur-sm z-30 border-primary/20">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) {
                  setSearchResults(searchCountries(e.target.value).slice(0, 10));
                } else {
                  setSearchResults([]);
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search any country..."
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <ScrollArea className="mt-2 max-h-60 border rounded-md">
            {searchResults.map((country) => (
              <div
                key={country.iso3}
                className="p-2 hover:bg-muted/50 cursor-pointer flex items-center gap-2 border-b last:border-0"
                onClick={() => selectCountry(country)}
              >
                <MapPin className="w-4 h-4 text-primary" />
                <div>
                  <div className="font-medium">{country.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {country.region} • {country.iso3}
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        )}

        <div className="flex gap-1 mt-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {ALL_COUNTRIES.length} countries
          </Badge>
          <Badge variant="outline" className="text-xs">
            {countryData.length} with data
          </Badge>
        </div>
      </Card>

      {/* Controls */}
      <Card className="absolute bottom-4 left-4 p-2 bg-card/95 backdrop-blur-sm z-30 border-primary/20">
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => map.current?.zoomIn()}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => map.current?.zoomOut()}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={resetView}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Selected Country Info */}
      {selectedCountry && (
        <Card className="absolute top-4 right-4 w-80 p-4 bg-card/95 backdrop-blur-sm z-30 border-primary/20 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Satellite className="w-5 h-5 text-primary" />
              <h3 className="font-orbitron font-bold">{selectedCountry.country}</h3>
            </div>
            <Badge>{selectedCountry.iso3}</Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coordinates</span>
              <span>{selectedCountry.latitude?.toFixed(2)}, {selectedCountry.longitude?.toFixed(2)}</span>
            </div>

            {selectedCountry.overall_score !== undefined && (
              <>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overall Risk</span>
                  <Badge variant={selectedCountry.overall_score >= 80 ? "destructive" : "default"}>
                    {selectedCountry.overall_score?.toFixed(0)}/100
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Health Risk</span>
                  <span>{selectedCountry.health_risk?.toFixed(0) || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Food Risk</span>
                  <span>{selectedCountry.food_risk?.toFixed(0) || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Energy Risk</span>
                  <span>{selectedCountry.energy_risk?.toFixed(0) || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Climate Risk</span>
                  <span>{selectedCountry.climate_risk?.toFixed(0) || "N/A"}</span>
                </div>
              </>
            )}

            {selectedCountry.population_affected && selectedCountry.population_affected > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Population</span>
                <span>{(selectedCountry.population_affected / 1000000).toFixed(1)}M</span>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setSelectedCountry(null)}>
            Close
          </Button>
        </Card>
      )}

      {/* Legend */}
      <Card className="absolute bottom-4 right-4 p-3 bg-card/95 backdrop-blur-sm z-30 border-primary/20">
        <div className="text-xs font-semibold mb-2 flex items-center gap-1">
          <Info className="w-3 h-3" /> Risk Level
        </div>
        <div className="space-y-1">
          {[
            { color: "hsl(142 76% 45%)", label: "Low (0-40)" },
            { color: "hsl(142 76% 55%)", label: "Medium (40-60)" },
            { color: "hsl(38 92% 50%)", label: "High (60-80)" },
            { color: "hsl(0 84% 60%)", label: "Critical (80+)" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
