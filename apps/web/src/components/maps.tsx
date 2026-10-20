import { distanceFromKimberley, insideMunicipality, KIMBERLEY_CENTRE, type LatLng } from '@civiclink/shared';
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

function Recenter({ to, zoom = 15 }: { to: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([to.lat, to.lng], Math.max(map.getZoom(), zoom));
  }, [to.lat, to.lng, map, zoom]);
  return null;
}

function ClickToMove({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

type GpsState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'ok'; accuracy: number }
  | { kind: 'denied' | 'unavailable' | 'timeout' | 'unsupported' }
  | { kind: 'outside'; km: number; accuracy: number };

const km = (m: number) => (m >= 10_000 ? `${Math.round(m / 1000)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/**
 * Location capture for a report (FR-03, BR-02): device GPS when allowed, adjustable by dragging the
 * pin or tapping the map (ADR-0004). `focus` pans the map (e.g. to the chosen suburb) without setting
 * a location, so a report is never filed at a guessed position.
 */
export function LocationPicker({
  value,
  onChange,
  invalid,
  focus,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  invalid?: boolean;
  focus?: LatLng | null;
}) {
  const [gps, setGps] = useState<GpsState>({ kind: 'idle' });
  const position = value ?? focus ?? KIMBERLEY_CENTRE;

  const locate = () => {
    if (!navigator.geolocation) return setGps({ kind: 'unsupported' });
    setGps({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        const accuracy = p.coords.accuracy;
        if (!insideMunicipality(loc)) {
          setGps({ kind: 'outside', km: distanceFromKimberley(loc), accuracy });
          return;
        }
        setGps({ kind: 'ok', accuracy });
        onChange(loc);
      },
      (err) =>
        setGps({ kind: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
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
          <Marker position={[position.lat, position.lng]} icon={pinIcon} draggable eventHandlers={markerHandlers} opacity={value ? 1 : 0.55} />
          <ClickToMove onChange={onChange} />
          {value ? <Recenter to={value} /> : focus ? <Recenter to={focus} zoom={14} /> : null}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600" data-testid="location-coords">
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Tap the map or drag the pin to the incident, or use your location'}
        </p>
        <Button type="button" variant="secondary" icon={LocateFixed} busy={gps.kind === 'locating'} onClick={locate}>
          Use my location
        </Button>
      </div>
      <div aria-live="polite">
        {gps.kind === 'ok' && gps.accuracy > 150 && (
          <p className="text-xs text-amber-700">Your location is approximate (within about {km(gps.accuracy)}). Drag the pin to the exact spot.</p>
        )}
        {gps.kind === 'outside' && (
          <p className="text-xs text-amber-700" data-testid="gps-outside">
            Your device reported a position about {km(gps.km)} from Kimberley
            {gps.accuracy > 1000 ? ` (accuracy only ±${km(gps.accuracy)}, so it is probably estimated from your internet connection)` : ''}, outside
            Sol Plaatje. Tap the map or drag the pin to where the incident is.
          </p>
        )}
        {gps.kind === 'denied' && <p className="text-xs text-amber-700">Location permission is blocked for this site. Allow it in your browser settings, or tap the map instead.</p>}
        {gps.kind === 'timeout' && <p className="text-xs text-amber-700">Finding your location took too long. Try again outdoors, or tap the map instead.</p>}
        {(gps.kind === 'unavailable' || gps.kind === 'unsupported') && <p className="text-xs text-amber-700">Your device could not provide a location. Tap the map instead.</p>}
      </div>
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
          <CircleMarker key={p.id} center={[p.location.lat, p.location.lng]} radius={9} pathOptions={{ color: 'white', weight: 2, fillColor: p.colour, fillOpacity: 0.9, className: `incident-marker incident-${p.id}` }}>
            <Popup>{p.popup}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
