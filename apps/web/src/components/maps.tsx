import { KIMBERLEY_CENTRE, MUNICIPAL_BOUNDS, type LatLng } from '@civiclink/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Button } from './ui';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#0b4f6c;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const inBounds = ({ lat, lng }: LatLng) =>
  lat >= MUNICIPAL_BOUNDS.minLat && lat <= MUNICIPAL_BOUNDS.maxLat && lng >= MUNICIPAL_BOUNDS.minLng && lng <= MUNICIPAL_BOUNDS.maxLng;

function Recenter({ to }: { to: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([to.lat, to.lng], Math.max(map.getZoom(), 15));
  }, [to.lat, to.lng, map]);
  return null;
}

function ClickToMove({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/**
 * Location capture for a report (FR-03): GPS from the device when allowed, adjustable by dragging
 * the pin or tapping the map (ADR-0004).
 */
export function LocationPicker({ value, onChange, invalid }: { value: LatLng | null; onChange: (p: LatLng) => void; invalid?: boolean }) {
  const [gps, setGps] = useState<'idle' | 'locating' | 'denied' | 'outside'>('idle');
  const position = value ?? KIMBERLEY_CENTRE;

  const locate = () => {
    if (!navigator.geolocation) return setGps('denied');
    setGps('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (!inBounds(loc)) {
          setGps('outside');
          return;
        }
        setGps('idle');
        onChange(loc);
      },
      () => setGps('denied'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const markerHandlers = useMemo(
    () => ({
      dragend: (e: L.LeafletEvent) => {
        const ll = (e.target as L.Marker).getLatLng();
        onChange({ lat: ll.lat, lng: ll.lng });
      },
    }),
    [onChange],
  );

  return (
    <div className="space-y-2">
      <div className={`h-64 overflow-hidden rounded-xl ring-1 ${invalid ? 'ring-red-400' : 'ring-slate-300'}`}>
        <MapContainer center={[position.lat, position.lng]} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
          <Marker position={[position.lat, position.lng]} icon={pinIcon} draggable eventHandlers={markerHandlers} />
          <ClickToMove onChange={onChange} />
          {value && <Recenter to={value} />}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600" data-testid="location-coords">
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Tap the map or use your location'}
        </p>
        <Button type="button" variant="secondary" icon={LocateFixed} busy={gps === 'locating'} onClick={locate}>
          Use my location
        </Button>
      </div>
      {gps === 'denied' && <p className="text-xs text-amber-700">Location access was blocked. Drag the pin to the incident instead.</p>}
      {gps === 'outside' && <p className="text-xs text-amber-700">You appear to be outside Sol Plaatje. Drag the pin to the incident location.</p>}
    </div>
  );
}

export interface MapPoint {
  id: string;
  location: LatLng;
  colour: string;
  popup: ReactNode;
}

/** Read-only incident map (FR-07, task location). */
export function IncidentMap({ points, height = 'h-80', zoom = 13, center }: { points: MapPoint[]; height?: string; zoom?: number; center?: LatLng }) {
  const c = center ?? KIMBERLEY_CENTRE;
  return (
    <div className={`${height} overflow-hidden rounded-xl ring-1 ring-slate-200`}>
      <MapContainer center={[c.lat, c.lng]} zoom={zoom} className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        {points.map((p) => (
          <CircleMarker key={p.id} center={[p.location.lat, p.location.lng]} radius={9} pathOptions={{ color: 'white', weight: 2, fillColor: p.colour, fillOpacity: 0.9 }}>
            <Popup>{p.popup}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
