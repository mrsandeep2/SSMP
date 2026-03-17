import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PROVIDER_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:36px;height:36px;border-radius:50%;
    background:linear-gradient(135deg,#2563eb,#1d4ed8);
    border:3px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.6);
    display:flex;align-items:center;justify-content:center;font-size:16px;">🚗</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const DEST_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:34px;height:34px;border-radius:50%;
    background:linear-gradient(135deg,#16a34a,#15803d);
    border:3px solid white;box-shadow:0 2px 8px rgba(22,163,74,0.6);
    display:flex;align-items:center;justify-content:center;font-size:16px;">📍</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

interface Props {
  destinationLat: number;
  destinationLng: number;
  destinationAddress?: string | null;
}

export default function ProviderNavigationMap({ destinationLat, destinationLng, destinationAddress }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const providerMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [providerPos, setProviderPos] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [destinationLat, destinationLng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    destinationMarkerRef.current = L.marker([destinationLat, destinationLng], { icon: DEST_ICON })
      .addTo(map)
      .bindPopup(destinationAddress || "Service location");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [destinationAddress, destinationLat, destinationLng]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setProviderPos({ lat, lng });
      },
      () => {
        // no-op
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !providerPos) return;

    if (!providerMarkerRef.current) {
      providerMarkerRef.current = L.marker([providerPos.lat, providerPos.lng], { icon: PROVIDER_ICON })
        .addTo(map)
        .bindPopup("You");
    } else {
      providerMarkerRef.current.setLatLng([providerPos.lat, providerPos.lng]);
    }

    if (routeRef.current) {
      routeRef.current.remove();
    }

    routeRef.current = L.polyline(
      [
        [providerPos.lat, providerPos.lng],
        [destinationLat, destinationLng],
      ],
      {
        color: "#38bdf8",
        weight: 4,
        opacity: 0.9,
        dashArray: "10 8",
      }
    ).addTo(map);

    const distance = haversineKm(providerPos.lat, providerPos.lng, destinationLat, destinationLng);
    setDistanceKm(distance);
    setEtaMin(Math.max(1, Math.round((distance / 30) * 60)));

    const bounds = L.latLngBounds([
      [providerPos.lat, providerPos.lng],
      [destinationLat, destinationLng],
    ]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [destinationLat, destinationLng, providerPos]);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`;

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-secondary/20">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/40">
        <div className="text-sm font-medium text-foreground">Navigate to service location</div>
        <div className="text-xs text-muted-foreground">
          {distanceKm !== null ? `${distanceKm.toFixed(2)} km` : "Calculating..."} {etaMin !== null ? `· ETA ~${etaMin} min` : ""}
        </div>
      </div>
      <div ref={containerRef} style={{ height: 280, width: "100%" }} />
      <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground truncate">{destinationAddress || "Service location"}</div>
        <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent hover:underline">
          Open in Maps
        </a>
      </div>
    </div>
  );
}

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
