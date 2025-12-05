import { useState, useRef, useEffect } from "react";
import { Header } from "./Header";
import { CommandBar } from "./CommandBar";
import { AlertsPanel } from "./AlertsPanel";
import { AnalyticsOverlay } from "./AnalyticsOverlay";
import { GlobalMap, GlobalMapRef } from "./GlobalMap";
import { type Country } from "@/lib/geo/all-countries";
import { supabase } from "@/integrations/supabase/client";

export const CommandCenter = () => {
  const mapRef = useRef<GlobalMapRef>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<{ name: string; iso3: string } | null>(null);

  // Fetch unread alerts count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("acknowledged", false);
      setUnreadAlerts(count || 0);
    };

    fetchUnreadCount();

    // Real-time subscription
    const channel = supabase
      .channel("alerts-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCountrySelect = (country: Country) => {
    mapRef.current?.flyToCountry(country);
    setSelectedCountry({ name: country.name, iso3: country.iso3 });
    setAnalyticsOpen(true);
  };

  const handleMapCountrySelect = (data: { country: string; iso3: string }) => {
    setSelectedCountry({ name: data.country, iso3: data.iso3 });
  };

  const handleNavigate = (view: string) => {
    if (view === "alerts") setAlertsOpen(true);
    if (view === "analytics") setAnalyticsOpen(true);
    if (view === "map") mapRef.current?.resetView();
  };

  const handleAlertClick = (alert: { country?: string }) => {
    // Alert click handler - country navigation handled separately
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      {/* Header */}
      <Header
        onToggleAlerts={() => setAlertsOpen(!alertsOpen)}
        onToggleAnalytics={() => setAnalyticsOpen(!analyticsOpen)}
        alertsOpen={alertsOpen}
        analyticsOpen={analyticsOpen}
        unreadAlerts={unreadAlerts}
      />

      {/* Main map area */}
      <div className="pt-14 pb-28 h-full">
        <GlobalMap
          ref={mapRef}
          onCountrySelect={handleMapCountrySelect}
          className="w-full h-full"
        />
      </div>

      {/* Overlays */}
      <AlertsPanel
        isOpen={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        onAlertClick={handleAlertClick}
      />

      <AnalyticsOverlay
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        selectedCountry={selectedCountry}
      />

      {/* Command bar at bottom */}
      <CommandBar
        onCountrySelect={handleCountrySelect}
        onNavigate={handleNavigate}
      />
    </div>
  );
};
