import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";

// Fix default leaflet marker icon paths broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

const PROVIDER_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:38px;height:38px;border-radius:50%;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);
    border:3px solid white;box-shadow:0 2px 8px rgba(99,102,241,0.6);
    display:flex;align-items:center;justify-content:center;
    font-size:18px;line-height:1;">🚗</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const SEEKER_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:34px;height:34px;border-radius:50%;
    background:linear-gradient(135deg,#10b981,#059669);
    border:3px solid white;box-shadow:0 2px 8px rgba(16,185,129,0.6);
    display:flex;align-items:center;justify-content:center;
    font-size:16px;line-height:1;">📍</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

/** Haversine distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMinutes(distKm: number) {
  // Assume 30 km/h average urban speed
  return Math.max(1, Math.round((distKm / 30) * 60));
}

interface Props {
  bookingId: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
}

export default function LiveTrackingMap({ bookingId, destinationLat, destinationLng }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const providerMarkerRef = useRef<L.Marker | null>(null);
  const seekerMarkerRef = useRef<L.Marker | null>(null);
  const [providerPos, setProviderPos] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);

  // Initialise the Leaflet map once
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const defaultCenter: L.LatLngTuple = destinationLat && destinationLng
      ? [destinationLat, destinationLng]
      : [20.5937, 78.9629]; // India centre as fallback

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add / update seeker marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !destinationLat || !destinationLng) return;

    if (seekerMarkerRef.current) {
      seekerMarkerRef.current.setLatLng([destinationLat, destinationLng]);
    } else {
      seekerMarkerRef.current = L.marker([destinationLat, destinationLng], { icon: SEEKER_ICON })
        .addTo(map)
        .bindPopup("Service location");
    }
  }, [destinationLat, destinationLng]);

  // Add / update provider marker + ETA
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !providerPos) return;

    if (providerMarkerRef.current) {
      providerMarkerRef.current.setLatLng([providerPos.lat, providerPos.lng]);
    } else {
      providerMarkerRef.current = L.marker([providerPos.lat, providerPos.lng], { icon: PROVIDER_ICON })
        .addTo(map)
        .bindPopup("Provider is on the way");
    }

    map.panTo([providerPos.lat, providerPos.lng]);

    if (destinationLat && destinationLng) {
      const dist = haversineKm(providerPos.lat, providerPos.lng, destinationLat, destinationLng);
      setEta(etaMinutes(dist));

      // Fit map to show both markers
      const bounds = L.latLngBounds(
        [providerPos.lat, providerPos.lng],
        [destinationLat, destinationLng]
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [providerPos, destinationLat, destinationLng]);

  // Fetch initial provider location + subscribe to realtime updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchInitial = async () => {
      const { data } = await supabase
        .from("provider_locations" as any)
        .select("latitude, longitude")
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (data) {
        const row = data as any;
        setProviderPos({ lat: row.latitude, lng: row.longitude });
      }
    };

    fetchInitial();

    channel = supabase
      .channel(`provider-location-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "provider_locations",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (row?.latitude && row?.longitude) {
            setProviderPos({ lat: row.latitude, lng: row.longitude });
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [bookingId]);

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 shadow-lg">
      {/* ETA banner */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-medium text-foreground">Provider is on the way</span>
        </div>
        {eta !== null ? (
          <span className="text-sm font-semibold text-accent">
            ETA ~{eta} min
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Waiting for provider location…</span>
        )}
      </div>

      {/* Map */}
      <div ref={mapContainerRef} style={{ height: 340, width: "100%" }} />

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 bg-secondary/30 text-xs text-muted-foreground">
        <span>🚗 Provider</span>
        <span>📍 Service location</span>
        {providerPos && (
          <span className="text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
