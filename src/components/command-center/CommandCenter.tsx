import { useState, useRef, useEffect, useCallback } from "react";
import { Header } from "./Header";
import { CommandBar } from "./CommandBar";
import { AlertsPanel } from "./AlertsPanel";
import { AnalyticsOverlay } from "./AnalyticsOverlay";
import { GlobalMap, GlobalMapRef } from "./GlobalMap";
import { CountryPanel } from "./CountryPanel";
import { type Country, getCountryCoordinates } from "@/lib/geo/all-countries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const CommandCenter = () => {
  const mapRef = useRef<GlobalMapRef>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<{
    name: string;
    iso3: string;
    lat: number;
    lng: number;
  } | null>(null);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "a" || e.key === "A") {
        setAlertsOpen(prev => !prev);
      }
      if (e.key === "d" || e.key === "D") {
        setAnalyticsOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setAlertsOpen(false);
        setAnalyticsOpen(false);
        setSelectedCountry(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
      lat: 0, // Will be updated when clicking on map
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

      {/* Main map area - adjusted for taller header */}
      <div className="pt-[88px] pb-24 h-full">
        <GlobalMap
          ref={mapRef}
          onCountrySelect={handleMapCountrySelect}
          className="w-full h-full"
        />
      </div>

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

      {/* Command bar at bottom */}
      <CommandBar
        onCountrySelect={handleCountrySelect}
        onNavigate={handleNavigate}
      />
    </div>
  );
};
