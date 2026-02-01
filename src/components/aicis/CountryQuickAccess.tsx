import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Globe, Search, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ALL_COUNTRIES, type Country } from "@/lib/geo/all-countries";

interface CountryQuickAccessProps {
  onSelect?: (country: Country) => void;
  triggerClassName?: string;
}

const REGIONS = ["Africa", "Americas", "Asia", "Europe", "Oceania"];

export function CountryQuickAccess({ onSelect, triggerClassName }: CountryQuickAccessProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const navigate = useNavigate();

  const filteredCountries = ALL_COUNTRIES.filter(country => {
    const matchesSearch = search === "" || 
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.iso3.toLowerCase().includes(search.toLowerCase());
    const matchesRegion = !selectedRegion || country.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  const handleSelect = (country: Country) => {
    if (onSelect) {
      onSelect(country);
    } else {
      navigate(`/deepdive/${country.iso3}`);
    }
    setOpen(false);
    setSearch("");
    setSelectedRegion(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={triggerClassName}>
          <Globe className="h-4 w-4 mr-2" />
          All Countries
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Country Deep-Dive Access
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search any country (Nauru, Tuvalu, Germany...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Region Filters */}
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant={selectedRegion === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedRegion(null)}
            >
              All Regions
            </Badge>
            {REGIONS.map(region => (
              <Badge
                key={region}
                variant={selectedRegion === region ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedRegion(region)}
              >
                {region}
              </Badge>
            ))}
          </div>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            {filteredCountries.length} countries available
          </p>

          {/* Country List */}
          <ScrollArea className="h-[400px] border rounded-md">
            <div className="grid grid-cols-2 gap-1 p-2">
              {filteredCountries.map(country => (
                <Button
                  key={country.iso3}
                  variant="ghost"
                  className="justify-start h-auto py-2 px-3 text-left"
                  onClick={() => handleSelect(country)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-medium text-sm truncate flex-1">
                      {country.name}
                    </span>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {country.iso3}
                    </Badge>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>

          {/* Small Nations Highlight */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              <strong className="text-foreground">🌴 Small Island Nations:</strong>{" "}
              Full support for SIDS including Nauru, Tuvalu, Kiribati, Palau, and all Pacific, Caribbean, and Indian Ocean nations.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
