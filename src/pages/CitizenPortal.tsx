import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCenter } from "@/components/AlertCenter";
import { PredictiveIntelligence } from "@/components/PredictiveIntelligence";
import { TrustPortal } from "@/components/TrustPortal";
import { NodeFederationPanel } from "@/components/NodeFederationPanel";
import { AICISCore } from "@/components/AICISCore";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Globe, Shield, Brain, AlertTriangle } from "lucide-react";

export default function CitizenPortal() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  AICIS Citizen Portal
                </h1>
                <p className="text-sm text-muted-foreground">
                  Global Coordination & Transparency Hub
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                Sovereign Access
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Alerts & Predictions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Live Global Alerts
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Real-time planetary early warning system
                </p>
              </CardHeader>
              <CardContent>
                <AlertCenter />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  Predictive Forecasts
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  90-day AI-driven intelligence outlook
                </p>
              </CardHeader>
              <CardContent>
                <PredictiveIntelligence />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - AI Interface & Trust */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AICIS Core Assistant
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Your personal AI coordinator
                </p>
              </CardHeader>
              <CardContent>
                <AICISCore />
              </CardContent>
            </Card>

            <Tabs defaultValue="trust" className="space-y-4">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="trust">
                  <Shield className="h-4 w-4 mr-2" />
                  Trust Portal
                </TabsTrigger>
                <TabsTrigger value="federation">
                  <Globe className="h-4 w-4 mr-2" />
                  Node Network
                </TabsTrigger>
              </TabsList>

              <TabsContent value="trust">
                <TrustPortal />
              </TabsContent>

              <TabsContent value="federation">
                <NodeFederationPanel />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Bottom Banner */}
        <Card className="mt-6 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
          <CardContent className="py-6">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">
                Every level participates, but no level dominates.
              </h3>
              <p className="text-muted-foreground">
                AICIS operates on sovereign data federation — your data remains yours, 
                while collective intelligence serves planetary peace.
              </p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <Badge variant="secondary">Zero-Trust Security</Badge>
                <Badge variant="secondary">Differential Privacy</Badge>
                <Badge variant="secondary">Ed25519 Signed</Badge>
                <Badge variant="secondary">GDPR Compliant</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
