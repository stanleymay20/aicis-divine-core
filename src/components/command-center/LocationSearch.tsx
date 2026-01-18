import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, MapPin, Loader2, Crosshair, Globe, Target
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationSearchProps {
  onLocationSelect: (location: { lat: number; lng: number; name: string; zoom?: number }) => void;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

export const LocationSearch = ({ onLocationSelect }: LocationSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "Area 51, Nevada",
    "Chernobyl, Ukraine",
    "Pentagon, Washington",
    "Kremlin, Moscow",
  ]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      // Use Nominatim for geocoding any location on earth
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8`
      );
      const data = await response.json();
      setResults(data);
      
      // Add to recent searches
      if (data.length > 0 && !recentSearches.includes(query)) {
        setRecentSearches(prev => [query, ...prev.slice(0, 4)]);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  }, [query, recentSearches]);

  const handleSelectLocation = (result: SearchResult) => {
    onLocationSelect({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      name: result.display_name,
      zoom: result.type === "country" ? 5 : result.type === "city" ? 10 : 15,
    });
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleQuickSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setTimeout(() => handleSearch(), 100);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="h-9 w-9 bg-card/90 backdrop-blur-sm border border-primary/20"
        >
          <Crosshair className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 font-orbitron">
            <Target className="h-5 w-5 text-primary" />
            Deep Location Search
          </SheetTitle>
        </SheetHeader>

        {/* Search input */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search any location on Earth... (e.g., 'Area 51' or coordinates)"
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Quick locations */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Recent & Notable:</p>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search) => (
              <Button
                key={search}
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleQuickSearch(search)}
              >
                <MapPin className="h-3 w-3" />
                {search}
              </Button>
            ))}
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="h-[calc(100%-160px)]">
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result, index) => (
                <button
                  key={index}
                  className="w-full p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors text-left"
                  onClick={() => handleSelectLocation(result)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <Globe className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">
                        {result.display_name.split(",")[0]}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {result.display_name.split(",").slice(1).join(",")}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {result.type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {parseFloat(result.lat).toFixed(4)}, {parseFloat(result.lon).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query && !isSearching ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Globe className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No locations found</p>
              <p className="text-xs">Try a different search term</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <MapPin className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Search for any location</p>
              <p className="text-xs">Cities, landmarks, coordinates, or remote areas</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
