import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Search } from "lucide-react";

const DEFAULT_CENTER: L.LatLngTuple = [20.5937, 78.9629];

const PIN_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:36px;height:36px;border-radius:50%;
    background:linear-gradient(135deg,#f97316,#ea580c);
    border:3px solid white;box-shadow:0 2px 8px rgba(249,115,22,0.5);
    display:flex;align-items:center;justify-content:center;
    font-size:16px;line-height:1;">📍</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

interface LocationValue {
  latitude: number;
  longitude: number;
  address: string;
}

interface Props {
  value: LocationValue | null;
  onChange: (location: LocationValue) => void;
}

export default function ServiceLocationPicker({ value, onChange }: Props) {
  const [mode, setMode] = useState<"gps" | "search" | "map">("gps");
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [searchHint, setSearchHint] = useState<string>("");
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsHint, setGpsHint] = useState<string>("");
  const [mapHint, setMapHint] = useState<string>("");
  const [mapCandidate, setMapCandidate] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<"gps" | "search" | "map">("gps");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const locationSummary = useMemo(() => {
    if (!value) return "No location selected yet";
    return `${value.address} (${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)})`;
  }, [value]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center: L.LatLngTuple = value
      ? [value.latitude, value.longitude]
      : DEFAULT_CENTER;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: value ? 15 : 5,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", async (evt: L.LeafletMouseEvent) => {
      const { lat, lng } = evt.latlng;
      const addr = await reverseGeocode(lat, lng);
      placeOrMovePin(lat, lng, map);
      if (modeRef.current === "map") {
        setMapCandidate({ latitude: lat, longitude: lng, address: addr });
        setMapHint("Pin marked. Click Confirm Pin to use this location.");
      } else {
        onChange({
          latitude: lat,
          longitude: lng,
          address: addr,
        });
      }
    });

    mapRef.current = map;

    if (value) placeOrMovePin(value.latitude, value.longitude, map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value || !mapRef.current) return;
    placeOrMovePin(value.latitude, value.longitude, mapRef.current);
    mapRef.current.panTo([value.latitude, value.longitude]);
  }, [value]);

  const placeOrMovePin = (lat: number, lng: number, map: L.Map) => {
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon: PIN_ICON }).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsHint("GPS is not supported in this browser. Use Search Address or Pick on Map.");
      return;
    }
    setDetectingGps(true);
    setGpsHint("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const addr = await reverseGeocode(lat, lng);
        onChange({ latitude: lat, longitude: lng, address: addr });
        setGpsHint("Location detected and pin placed on map.");
        setDetectingGps(false);
        if (mapRef.current) {
          placeOrMovePin(lat, lng, mapRef.current);
          mapRef.current.setView([lat, lng], 15);
        }
      },
      (err) => {
        setDetectingGps(false);
        if (err.code === 1) {
          setGpsHint("Location permission denied. Please allow location access in browser settings.");
        } else if (err.code === 3) {
          setGpsHint("Location request timed out. Try again or use Pick on Map.");
        } else {
          setGpsHint("Unable to detect location. Use Search Address or Pick on Map.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const runSearch = async () => {
    const q = search.trim();
    if (!q) return;

    setSearching(true);
    setSearchHint("");

    try {
      // Primary: Nominatim
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      const primary = Array.isArray(data) ? data : [];

      if (primary.length > 0) {
        setSuggestions(primary);
        return;
      }

      // Fallback: maps.co geocoder
      const fallbackUrl = `https://geocode.maps.co/search?q=${encodeURIComponent(q)}&limit=5`;
      const fallbackRes = await fetch(fallbackUrl, { headers: { Accept: "application/json" } });
      const fallbackData = await fallbackRes.json();
      const fallback = (Array.isArray(fallbackData) ? fallbackData : []).map((row: any) => ({
        display_name: row.display_name,
        lat: String(row.lat),
        lon: String(row.lon),
      }));

      setSuggestions(fallback);
      if (fallback.length === 0) {
        setSearchHint("No results found. Try a broader area, city, or PIN code.");
      }
    } catch {
      setSuggestions([]);
      setSearchHint("Search service is temporarily unavailable. Try 'Pick on Map'.");
    } finally {
      setSearching(false);
    }
  };

  const selectSuggestion = (s: { display_name: string; lat: string; lon: string }) => {
    const lat = Number(s.lat);
    const lng = Number(s.lon);
    onChange({ latitude: lat, longitude: lng, address: s.display_name });
    setSuggestions([]);
    if (mapRef.current) {
      placeOrMovePin(lat, lng, mapRef.current);
      mapRef.current.setView([lat, lng], 15);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
      <div>
        <div className="text-sm font-medium text-foreground mb-2">Select Service Location</div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "gps" ? "default" : "outline"}
            onClick={() => {
              setMode("gps");
              useCurrentLocation();
            }}
            disabled={detectingGps}
          >
            <Navigation className="w-4 h-4 mr-1" /> Use My Current Location
          </Button>
          <Button type="button" size="sm" variant={mode === "search" ? "default" : "outline"} onClick={() => setMode("search")}>
            <Search className="w-4 h-4 mr-1" /> Search Address
          </Button>
          <Button type="button" size="sm" variant={mode === "map" ? "default" : "outline"} onClick={() => setMode("map")}>
            <MapPin className="w-4 h-4 mr-1" /> Pick on Map
          </Button>
        </div>
      </div>

      {mode === "gps" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="hero" onClick={useCurrentLocation} disabled={detectingGps}>
              {detectingGps ? "Detecting..." : "Detect Again"}
            </Button>
            <span className="text-xs text-muted-foreground">Uses device GPS to capture exact coordinates.</span>
          </div>
          {gpsHint && <span className="text-xs text-muted-foreground">{gpsHint}</span>}
        </div>
      )}

      {mode === "search" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Search address (e.g. Connaught Place)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="bg-secondary/50"
            />
            <Button type="button" variant="outline" onClick={runSearch} disabled={searching || !search.trim()}>
              {searching ? "Searching..." : "Search"}
            </Button>
          </div>
          {searchHint && <div className="text-xs text-muted-foreground">{searchHint}</div>}
          {suggestions.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border/50 bg-background/80">
              {suggestions.map((s) => (
                <button
                  key={`${s.lat}-${s.lon}-${s.display_name.slice(0, 16)}`}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-secondary/40"
                  onClick={() => selectSuggestion(s)}
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "map" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="hero"
              disabled={!mapCandidate}
              onClick={() => {
                if (!mapCandidate) return;
                onChange(mapCandidate);
                setMapHint("Location selected from map.");
              }}
            >
              Confirm Pin
            </Button>
            <span className="text-xs text-muted-foreground">
              Click anywhere on the map to mark the exact service location.
            </span>
          </div>
          {mapHint && <span className="text-xs text-muted-foreground">{mapHint}</span>}
        </div>
      )}

      <div className="rounded-lg overflow-hidden border border-border/50">
        <div ref={mapContainerRef} style={{ height: 240, width: "100%" }} />
      </div>

      <div className="text-xs text-muted-foreground">
        {locationSummary}
      </div>
    </div>
  );
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}
