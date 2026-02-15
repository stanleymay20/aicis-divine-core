import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";

const EnterpriseGovernance = lazy(() => import("./pages/EnterpriseGovernance"));
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { IntelligenceMemoryProvider } from "@/contexts/IntelligenceMemoryContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import CitizenPortal from "./pages/CitizenPortal";
import CountryDeepDivePage from "./pages/CountryDeepDivePage";
import AICISCommandCenter from "./pages/AICISCommandCenter";
import Debug from "./pages/Debug";
import SystemHealth from "./pages/SystemHealth";
import AdminDashboard from "./pages/AdminDashboard";
import GovernanceHub from "./pages/GovernanceHub";
import PredictionsCenter from "./pages/PredictionsCenter";
import CompliancePortal from "./pages/CompliancePortal";
import FederationHub from "./pages/FederationHub";
import Ethics from "./pages/Ethics";
import NotFound from "./pages/NotFound";
import SecurityDashboard from "./pages/SecurityDashboard";
import HealthDashboard from "./pages/HealthDashboard";
import ComparePage from "./pages/ComparePage";
import IntelligenceThread from "./pages/IntelligenceThread";
import MethodologyPage from "./pages/MethodologyPage";
const CalibrationDashboard = lazy(() => import("./pages/CalibrationDashboard"));
const GovernanceLegal = lazy(() => import("./pages/GovernanceLegal"));
const ReadinessReport = lazy(() => import("./pages/ReadinessReport"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <IntelligenceMemoryProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/citizen-portal" element={<CitizenPortal />} />
            <Route path="/deepdive/:iso3" element={<CountryDeepDivePage />} />
            <Route path="/command" element={<AICISCommandCenter />} />
            <Route path="/debug" element={<Debug />} />
            <Route path="/system-health" element={<SystemHealth />} />
            <Route path="/health" element={<HealthDashboard />} />
            <Route path="/security" element={<SecurityDashboard />} />
            <Route path="/intelligence" element={<IntelligenceThread />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/governance" element={<GovernanceHub />} />
            <Route path="/predictions" element={<PredictionsCenter />} />
            <Route path="/compliance" element={<CompliancePortal />} />
            <Route path="/federation" element={<FederationHub />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="/enterprise-governance" element={<Suspense fallback={<div className="p-8 text-center">Loading...</div>}><EnterpriseGovernance /></Suspense>} />
            <Route path="/calibration" element={<Suspense fallback={<div className="p-8 text-center">Loading...</div>}><CalibrationDashboard /></Suspense>} />
            <Route path="/governance-legal" element={<Suspense fallback={<div className="p-8 text-center">Loading...</div>}><GovernanceLegal /></Suspense>} />
            <Route path="/readiness-report" element={<Suspense fallback={<div className="p-8 text-center">Loading...</div>}><ReadinessReport /></Suspense>} />
            <Route path="/ethics" element={<Ethics />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </IntelligenceMemoryProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
