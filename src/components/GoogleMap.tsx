import React, { useCallback, useRef, useState } from 'react';
import {
  GoogleMap as GMap,
  useJsApiLoader,
  Autocomplete,
  Marker,
} from '@react-google-maps/api';

const LIBRARIES: ('places')[] = ['places'];

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface GoogleMapProps {
  height?: number | string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onLocationSelect?: (lat: number, lng: number, placeName: string) => void;
  activeRideRoute?: {
    pickup: [number, number];
    destination: [number, number];
    driver?: [number, number];
  };
  mode?: 'rider' | 'driver' | 'ceo' | 'default';
  containerStyle?: React.CSSProperties;
}

const mapStyleDark = [
  { elementType: 'geometry', stylers: [{ color: '#0d0a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1230' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2a1a4a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c1f5a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f1454' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0a1a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1230' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b5a7e' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1a0f' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2a1a4a' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#8B5CF6' }] },
];

const GoogleMapComponent: React.FC<GoogleMapProps> = ({
  height = 300,
  center = { lat: 6.5244, lng: 3.3792 },
  zoom = 11,
  markers = [],
  onLocationSelect,
  activeRideRoute,
  mode = 'default',
  containerStyle,
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [clickedMarker, setClickedMarker] = useState<{ lat: number; lng: number } | null>(null);

  const heightPx = typeof height === 'number' ? `${height}px` : height;

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onAutocompleteLoad = (ac: google.maps.places.Autocomplete) => {
    autocompleteRef.current = ac;
  };

  const onPlaceChanged = () => {
    const ac = autocompleteRef.current;
    if (!ac) return;
    const place = ac.getPlace();
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(15);
      setClickedMarker({ lat, lng });
      onLocationSelect?.(lat, lng, place.formatted_address || place.name || '');
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setClickedMarker({ lat, lng });
    onLocationSelect?.(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  const wrapStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: (containerStyle?.borderRadius as string) || '20px',
    overflow: 'hidden',
    ...containerStyle,
  };

  if (loadError) {
    return (
      <div style={{ ...wrapStyle, height: heightPx, background: 'linear-gradient(135deg, #0d0618 0%, #1a0a2e 50%, #0d1a2e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗺️</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontFamily: 'Poppins', textAlign: 'center', margin: 0 }}>Map unavailable</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ ...wrapStyle, height: heightPx, background: 'linear-gradient(135deg, #0d0618, #1a0a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div style={{ fontSize: '36px' }}>🗺️</div>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(139,92,246,0.25)', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontFamily: 'Poppins', margin: 0 }}>Loading map…</p>
      </div>
    );
  }

  const mapContainerStyle = { width: '100%', height: heightPx };

  return (
    <div style={wrapStyle}>
      {/* Search bar with Google Places Autocomplete */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 10 }}>
        <Autocomplete
          onLoad={onAutocompleteLoad}
          onPlaceChanged={onPlaceChanged}
          options={{ types: ['geocode', 'establishment'] }}
        >
          <input
            type="text"
            placeholder="🔍 Search any place..."
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '14px',
              background: 'rgba(13,6,24,0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(139,92,246,0.35)',
              color: 'white',
              fontSize: '13px',
              fontFamily: "'Poppins', sans-serif",
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </Autocomplete>
      </div>

      <GMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={zoom}
        options={{
          styles: mapStyleDark,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
        onLoad={onLoad}
        onClick={onLocationSelect ? handleMapClick : undefined}
      >
        {/* Driver / online markers */}
        {markers.map(m => (
          <Marker
            key={m.id}
            position={{ lat: m.lat, lng: m.lng }}
            label={{ text: '🚗', fontSize: '22px', color: m.color || '#8B5CF6' }}
            title={m.label}
            icon={{
              url: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><text y='26' font-size='24'>🚗</text></svg>`,
              scaledSize: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 28),
            }}
          />
        ))}

        {/* Clicked / selected marker */}
        {clickedMarker && (
          <Marker
            position={clickedMarker}
            icon={{
              url: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><text y='28' font-size='26'>📍</text></svg>`,
              scaledSize: new google.maps.Size(32, 36),
              anchor: new google.maps.Point(16, 36),
            }}
          />
        )}

        {/* Active ride route markers */}
        {activeRideRoute && (
          <>
            <Marker
              position={{ lat: activeRideRoute.pickup[1], lng: activeRideRoute.pickup[0] }}
              icon={{
                url: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><text y='28' font-size='26'>📍</text></svg>`,
                scaledSize: new google.maps.Size(32, 36),
                anchor: new google.maps.Point(16, 36),
              }}
            />
            <Marker
              position={{ lat: activeRideRoute.destination[1], lng: activeRideRoute.destination[0] }}
              icon={{
                url: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><text y='28' font-size='26'>🏁</text></svg>`,
                scaledSize: new google.maps.Size(32, 36),
                anchor: new google.maps.Point(16, 36),
              }}
            />
            {activeRideRoute.driver && (
              <Marker
                position={{ lat: activeRideRoute.driver[1], lng: activeRideRoute.driver[0] }}
                icon={{
                  url: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'><text y='30' font-size='28'>🚗</text></svg>`,
                  scaledSize: new google.maps.Size(36, 36),
                  anchor: new google.maps.Point(18, 18),
                }}
              />
            )}
          </>
        )}
      </GMap>
    </div>
  );
};

export default GoogleMapComponent;
