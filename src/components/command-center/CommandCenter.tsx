import { useState, useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { Header } from "./Header";
import { CommandBar } from "./CommandBar";
import { AlertsPanel } from "./AlertsPanel";
import { AnalyticsOverlay } from "./AnalyticsOverlay";
import { GlobalMap, GlobalMapRef } from "./GlobalMap";
import { CountryPanel } from "./CountryPanel";
import { IntelligenceHUD } from "./IntelligenceHUD";
import { DataStreamPanel } from "./DataStreamPanel";
import { GlobalStatsBar } from "./GlobalStatsBar";
import { MiniMap } from "./MiniMap";
import { KeyboardShortcutsModal, useKeyboardShortcuts } from "./KeyboardShortcuts";
import { type Country, getCountryCoordinates } from "@/lib/geo/all-countries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const CommandCenter = () => {
  const mapRef = useRef<GlobalMapRef>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [mainMap, setMainMap] = useState<maplibregl.Map | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<{
    name: string;
    iso3: string;
    lat: number;
    lng: number;
  } | null>(null);

  // Sync main map reference for MiniMap
  useEffect(() => {
    const interval = setInterval(() => {
      const m = mapRef.current?.getMap();
      if (m && !mainMap) setMainMap(m);
    }, 500);
    return () => clearInterval(interval);
  }, [mainMap]);

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

  const handleCountrySelect = useCallback((country: Country) => {
    const coords = getCountryCoordinates(country.iso2);
    mapRef.current?.flyToCountry(country);
    setSelectedCountry({
      name: country.name,
      iso3: country.iso3,
      lat: coords?.lat || 0,
      lng: coords?.lng || 0,
    });
    toast.success(`Navigating to ${country.name}`);
  }, []);

  const handleMapCountrySelect = useCallback((data: { country: string; iso3: string }) => {
    setSelectedCountry({
      name: data.country,
      iso3: data.iso3,
      lat: 0,
      lng: 0,
    });
  }, []);

  const handleNavigate = useCallback((view: string) => {
    if (view === "alerts") setAlertsOpen(true);
    if (view === "analytics") setAnalyticsOpen(true);
    if (view === "map") {
      mapRef.current?.resetView();
      setSelectedCountry(null);
    }
  }, []);

  const handleAlertClick = useCallback((alert: { country?: string }) => {
    if (alert.country) {
      toast.info(`Alert from ${alert.country}`);
    }
  }, []);

  // Keyboard shortcuts
  const shortcutHandlers = {
    a: () => setAlertsOpen(prev => !prev),
    d: () => setAnalyticsOpen(prev => !prev),
    escape: () => {
      setAlertsOpen(false);
      setAnalyticsOpen(false);
      setSelectedCountry(null);
    },
    g: () => mapRef.current?.spinGlobe(),
    r: () => mapRef.current?.resetView(),
    "cmd+k": () => {
      const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      input?.focus();
    },
  };

  const { showShortcuts, setShowShortcuts } = useKeyboardShortcuts(shortcutHandlers);

  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      {/* Header with live ticker */}
      <Header
        onToggleAlerts={() => setAlertsOpen(!alertsOpen)}
        onToggleAnalytics={() => setAnalyticsOpen(!analyticsOpen)}
        alertsOpen={alertsOpen}
        analyticsOpen={analyticsOpen}
        unreadAlerts={unreadAlerts}
      />

      {/* Main map area */}
      <div className="pt-[88px] pb-24 h-full">
        <GlobalMap
          ref={mapRef}
          onCountrySelect={handleMapCountrySelect}
          className="w-full h-full"
        />
      </div>

      {/* Global stats bar - centered top */}
      <GlobalStatsBar />

      {/* Intelligence HUD - top right */}
      <IntelligenceHUD />

      {/* Data stream panel - bottom right */}
      <DataStreamPanel />

      {/* MiniMap - bottom left */}
      <MiniMap mainMap={mainMap} />

      {/* Country detail panel */}
      <CountryPanel
        country={selectedCountry}
        onClose={() => setSelectedCountry(null)}
      />

      {/* Overlays */}
      <AlertsPanel
        isOpen={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        onAlertClick={handleAlertClick}
      />

      <AnalyticsOverlay
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        selectedCountry={selectedCountry ? { name: selectedCountry.name, iso3: selectedCountry.iso3 } : null}
      />

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* Command bar at bottom */}
      <CommandBar
        onCountrySelect={handleCountrySelect}
        onNavigate={handleNavigate}
      />
    </div>
  );
};
