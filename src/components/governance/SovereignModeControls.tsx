/**
 * Sovereign Mode Controls - Jurisdictional Data Governance
 * Controls for data sovereignty, privacy boundaries, and federated operation
 */
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Shield, 
  Globe, 
  Lock,
  Eye,
  EyeOff,
  Server,
  Users,
  FileCheck,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

interface SovereignConfig {
  mode: "global" | "regional" | "national" | "isolated";
  dataSharing: {
    aggregatesOnly: boolean;
    requireConsent: boolean;
    retentionDays: number;
  };
  jurisdictions: string[];
  classifications: {
    public: boolean;
    restricted: boolean;
    confidential: boolean;
  };
}

const SOVEREIGN_MODES = [
  { 
    id: "global", 
    label: "Global Public", 
    description: "Non-sensitive aggregated intelligence available globally",
    icon: Globe,
    color: "text-success"
  },
  { 
    id: "regional", 
    label: "Regional Federation", 
    description: "Shared within regional bloc (e.g., ECOWAS, EU, AU)",
    icon: Users,
    color: "text-primary"
  },
  { 
    id: "national", 
    label: "National Sovereign", 
    description: "Data stays within national boundaries, controlled exports",
    icon: Shield,
    color: "text-warning"
  },
  { 
    id: "isolated", 
    label: "Air-Gapped / Isolated", 
    description: "Complete isolation, no external data sharing",
    icon: Lock,
    color: "text-destructive"
  }
];

const NON_SURVEILLANCE_GUARANTEES = [
  "No personal data collection",
  "No facial recognition integration",
  "No individual tracking or profiling",
  "Aggregated, anonymized data only",
  "Transparent data provenance",
  "Right to audit all data flows"
];

export const SovereignModeControls = () => {
  const [config, setConfig] = useState<SovereignConfig>({
    mode: "global",
    dataSharing: {
      aggregatesOnly: true,
      requireConsent: true,
      retentionDays: 365
    },
    jurisdictions: [],
    classifications: {
      public: true,
      restricted: false,
      confidential: false
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [federationPeers, setFederationPeers] = useState<number>(0);

  useEffect(() => {
    // Fetch current federation status
    const fetchFederationStatus = async () => {
      const { count } = await supabase
        .from("federation_peers")
        .select("*", { count: "exact", head: true })
        .eq("send_enabled", true);
      
      setFederationPeers(count || 0);
    };

    fetchFederationStatus();
  }, []);

  const handleModeChange = (mode: SovereignConfig["mode"]) => {
    setConfig(prev => ({
      ...prev,
      mode,
      // Auto-adjust settings based on mode
      dataSharing: {
        ...prev.dataSharing,
        aggregatesOnly: mode !== "global",
        requireConsent: mode !== "global"
      },
      classifications: {
        public: mode === "global",
        restricted: mode === "regional" || mode === "national",
        confidential: mode === "national" || mode === "isolated"
      }
    }));
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      // Update federation policies
      const { error } = await supabase
        .from("federation_policies")
        .upsert({
          id: "00000000-0000-0000-0000-000000000001",
          enabled: config.mode !== "isolated",
          share_divisions: config.classifications.public ? 
            ["health", "food", "energy", "governance"] : 
            config.classifications.restricted ? ["governance"] : [],
          data_classification: config.mode,
          jurisdiction: config.jurisdictions.join(",")
        });

      if (error) throw error;

      toast.success("Sovereign configuration saved", {
        description: `Mode: ${SOVEREIGN_MODES.find(m => m.id === config.mode)?.label}`
      });
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sovereign Mode Selector */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Sovereign Mode Configuration
            <Badge variant="outline" className="ml-2 text-xs">
              Data Governance
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Control data sovereignty, sharing boundaries, and jurisdictional compliance
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Mode Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SOVEREIGN_MODES.map((mode) => (
              <div
                key={mode.id}
                onClick={() => handleModeChange(mode.id as SovereignConfig["mode"])}
                className={cn(
                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                  config.mode === mode.id 
                    ? "border-primary bg-primary/10" 
                    : "border-muted hover:border-muted-foreground/50"
                )}
              >
                <mode.icon className={cn("h-8 w-8 mb-3", mode.color)} />
                <h4 className="font-semibold mb-1">{mode.label}</h4>
                <p className="text-xs text-muted-foreground">{mode.description}</p>
                {config.mode === mode.id && (
                  <CheckCircle2 className="h-5 w-5 text-primary mt-2" />
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* Data Sharing Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Server className="h-4 w-4" />
                Data Sharing Rules
              </h4>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="aggregates" className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Aggregates Only
                </Label>
                <Switch
                  id="aggregates"
                  checked={config.dataSharing.aggregatesOnly}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({
                      ...prev,
                      dataSharing: { ...prev.dataSharing, aggregatesOnly: checked }
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="consent" className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                  Require Explicit Consent
                </Label>
                <Switch
                  id="consent"
                  checked={config.dataSharing.requireConsent}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({
                      ...prev,
                      dataSharing: { ...prev.dataSharing, requireConsent: checked }
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Data Retention Period</Label>
                <Select
                  value={config.dataSharing.retentionDays.toString()}
                  onValueChange={(value) => 
                    setConfig(prev => ({
                      ...prev,
                      dataSharing: { ...prev.dataSharing, retentionDays: parseInt(value) }
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="180">180 Days</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                    <SelectItem value="730">2 Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Data Classification Visibility
              </h4>
              
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-success" />
                  Public Intelligence
                </Label>
                <Switch
                  checked={config.classifications.public}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({
                      ...prev,
                      classifications: { ...prev.classifications, public: checked }
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-warning" />
                  Restricted Intelligence
                </Label>
                <Switch
                  checked={config.classifications.restricted}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({
                      ...prev,
                      classifications: { ...prev.classifications, restricted: checked }
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-destructive" />
                  Confidential Intelligence
                </Label>
                <Switch
                  checked={config.classifications.confidential}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({
                      ...prev,
                      classifications: { ...prev.classifications, confidential: checked }
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Federation Status */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Federation Network Status</h4>
                <p className="text-sm text-muted-foreground">
                  {federationPeers} active peer{federationPeers !== 1 ? "s" : ""} in network
                </p>
              </div>
              <Badge variant={config.mode === "isolated" ? "destructive" : "default"}>
                {config.mode === "isolated" ? "Isolated" : "Connected"}
              </Badge>
            </div>
          </div>

          <Button onClick={saveConfiguration} disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save Sovereign Configuration"}
          </Button>
        </CardContent>
      </Card>

      {/* Non-Surveillance Guarantees */}
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-success" />
            Non-Surveillance Guarantee
            <Badge className="ml-2 bg-success text-success-foreground text-xs">
              Active
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AICIS explicitly prohibits surveillance activities — this is non-negotiable
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {NON_SURVEILLANCE_GUARANTEES.map((guarantee, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 p-2 bg-success/10 rounded"
              >
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                <span className="text-sm">{guarantee}</span>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium">Transparency Notice</p>
                <p className="text-xs text-muted-foreground">
                  All data flows are auditable. Any deviation from these guarantees 
                  triggers automatic alerting and is logged to the immutable ledger.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
