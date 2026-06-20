import { useRef, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
  position: { lat: number, lng: number };
  onPositionChange: (pos: { lat: number, lng: number }) => void;
}

export default function MapPicker({ position, onPositionChange }: MapPickerProps) {
  const mapRef = useRef<L.Map>(null);
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const pos = marker.getLatLng();
          onPositionChange({ lat: pos.lat, lng: pos.lng });
        }
      },
    }),
    [onPositionChange],
  );

  function MapEvents() {
    useMapEvents({
      click(e) {
        onPositionChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return null;
  }

  useEffect(() => {
    // Intentar obtener la ubicación del usuario si aún tiene la por defecto
    if (position.lat === 6.2442 && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          onPositionChange({ lat: latitude, lng: longitude });
          if (mapRef.current) {
            mapRef.current.setView([latitude, longitude], 18);
          }
        },
        () => {
          // Ignorar errores (usuario denegó permiso o no disponible)
        }
      );
    }
  }, []);

  return (
    <div className="h-[300px] w-full rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm relative z-0">
      <MapContainer 
        center={position} 
        zoom={16} 
        minZoom={16} 
        maxZoom={20}
        ref={mapRef} 
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          draggable={true}
          eventHandlers={eventHandlers}
          position={position}
          ref={markerRef}
        >
          <Popup minWidth={90}>Mueve el marcador a tu puerta exacta.</Popup>
        </Marker>
        <MapEvents />
      </MapContainer>
    </div>
  );
}
