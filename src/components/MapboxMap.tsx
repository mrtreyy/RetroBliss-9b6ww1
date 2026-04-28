import React, { useEffect, useRef, useState, useCallback } from 'react';

const MAPBOX_TOKEN = 'sk.eyJ1IjoicGVhY2U1NDMiLCJhIjoiY21vajI0cjdyMDdqcTJwcjB3b3htZWNjMCJ9.AFVm6Y_6whrhgvnqtz8xNw';

export interface CarMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  routeCoords?: [number, number][];
  pickup?: [number, number];
  destination?: [number, number];
}

interface MapboxMapProps {
  height?: string | number;
  center?: [number, number];
  zoom?: number;
  markers?: CarMarker[];
  onLocationSelect?: (lat: number, lng: number, placeName: string) => void;
  showSearch?: boolean;
  activeRideRoute?: { pickup: [number, number]; destination: [number, number]; driver?: [number, number] };
  mode?: 'rider' | 'driver' | 'ceo' | 'default';
  onMapLoad?: () => void;
  availableLocations?: string[];
  style?: React.CSSProperties;
}

declare global {
  interface Window {
    mapboxgl: typeof import('mapbox-gl');
    MapboxGeocoder: unknown;
  }
}

const MapboxMap: React.FC<MapboxMapProps> = ({
  height = 300,
  center = [3.3792, 6.5244],
  zoom = 12,
  markers = [],
  onLocationSelect,
  showSearch = false,
  activeRideRoute,
  mode = 'default',
  onMapLoad,
  style: containerStyle,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const markersRef = useRef<Map<string, import('mapbox-gl').Marker>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const initAttempted = useRef(false);

  const loadMapboxScripts = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.mapboxgl) { resolve(); return; }

      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css';
      document.head.appendChild(cssLink);

      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Mapbox failed to load'));
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    loadMapboxScripts().then(() => {
      if (!mapContainer.current) return;
      if (mapRef.current) return;

      try {
        window.mapboxgl.accessToken = MAPBOX_TOKEN;

        const map = new window.mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center,
          zoom,
          attributionControl: false,
          logoPosition: 'bottom-right',
        });

        mapRef.current = map;

        map.addControl(new window.mapboxgl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

        map.on('load', () => {
          setLoaded(true);
          onMapLoad?.();

          // Add pulsing location dot for rider/driver
          if (mode === 'rider' || mode === 'driver') {
            const size = 14;
            const pulsingDot = {
              width: size,
              height: size,
              data: new Uint8Array(size * size * 4),
              onAdd() {
                const canvas = document.createElement('canvas');
                canvas.width = this.width;
                canvas.height = this.height;
                this.context = canvas.getContext('2d');
              },
              render() {
                const duration = 1500;
                const t = (performance.now() % duration) / duration;
                const radius = (size / 2) * 0.3;
                const outerRadius = (size / 2) * 0.7 * t + radius;
                const context = this.context as CanvasRenderingContext2D;
                context.clearRect(0, 0, this.width, this.height);
                context.beginPath();
                context.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
                context.fillStyle = `rgba(139, 92, 246, ${1 - t})`;
                context.fill();
                context.beginPath();
                context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
                context.fillStyle = '#8B5CF6';
                context.strokeStyle = 'white';
                context.lineWidth = 1;
                context.fill();
                context.stroke();
                this.data = context.getImageData(0, 0, this.width, this.height).data;
                if (map && map.isStyleLoaded()) {
                  try { map.triggerRepaint(); } catch { /* ignore */ }
                }
                return true;
              }
            };

            try {
              if (!map.hasImage('pulsing-dot')) {
                map.addImage('pulsing-dot', pulsingDot as Parameters<typeof map.addImage>[1], { pixelRatio: 2 });
              }
            } catch { /* ignore */ }
          }
        });

        map.on('error', () => {
          setError(true);
        });

        if (onLocationSelect) {
          map.on('click', (e) => {
            onLocationSelect(e.lngLat.lat, e.lngLat.lng, `${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`);
          });
        }
      } catch {
        setError(true);
      }
    }).catch(() => setError(true));

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* ignore */ }
        mapRef.current = null;
        initAttempted.current = false;
      }
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    // Remove old markers not in new list
    const newIds = new Set(markers.map(m => m.id));
    markersRef.current.forEach((marker, id) => {
      if (!newIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });

    // Add or update markers
    markers.forEach(m => {
      const existing = markersRef.current.get(m.id);
      if (existing) {
        existing.setLngLat([m.lng, m.lat]);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `<div style="font-size:24px;filter:drop-shadow(0 0 6px ${m.color || '#8B5CF6'});cursor:pointer;line-height:1;transform-origin:center bottom;" title="${m.label || ''}">🚗</div>`;
        el.style.cssText = 'pointer-events:auto;';

        const marker = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([m.lng, m.lat]);

        if (m.label) {
          marker.setPopup(new window.mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
            `<p style="font-family:Poppins,sans-serif;font-size:12px;color:white;margin:0;font-weight:500;">${m.label}</p>`
          ));
        }
        marker.addTo(map);
        markersRef.current.set(m.id, marker);
      }
    });
  }, [markers, loaded]);

  // Draw route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !activeRideRoute) return;

    const { pickup, destination, driver } = activeRideRoute;

    const tryDrawRoute = () => {
      if (!map.isStyleLoaded()) { setTimeout(tryDrawRoute, 200); return; }

      try {
        // Add/update pickup marker
        if (!markersRef.current.has('pickup')) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="font-size:20px;filter:drop-shadow(0 0 8px #4ADE80)">📍</div>';
          const m = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(pickup).addTo(map);
          markersRef.current.set('pickup', m);
        } else {
          markersRef.current.get('pickup')?.setLngLat(pickup);
        }

        if (!markersRef.current.has('destination')) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="font-size:20px;filter:drop-shadow(0 0 8px #EC4899)">🏁</div>';
          const m = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(destination).addTo(map);
          markersRef.current.set('destination', m);
        } else {
          markersRef.current.get('destination')?.setLngLat(destination);
        }

        if (driver) {
          if (!markersRef.current.has('driver-car')) {
            const el = document.createElement('div');
            el.innerHTML = '<div style="font-size:26px;filter:drop-shadow(0 0 10px #8B5CF6)">🚗</div>';
            const m = new window.mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(driver).addTo(map);
            markersRef.current.set('driver-car', m);
          } else {
            markersRef.current.get('driver-car')?.setLngLat(driver);
          }
        }

        // Draw route line
        const coords = [pickup, destination];
        const routeGeoJSON: GeoJSON.Feature = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        };

        if (map.getSource('route')) {
          (map.getSource('route') as import('mapbox-gl').GeoJSONSource).setData(routeGeoJSON);
        } else {
          map.addSource('route', { type: 'geojson', data: routeGeoJSON });
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#8B5CF6', 'line-width': 4, 'line-opacity': 0.85, 'line-dasharray': [0, 2] },
          });
        }

        // Fit bounds
        const bounds = new window.mapboxgl.LngLatBounds(pickup, destination);
        map.fitBounds(bounds, { padding: 60, duration: 1000 });
      } catch (e) {
        console.log('Route draw error:', e);
      }
    };

    tryDrawRoute();
  }, [activeRideRoute, loaded]);

  if (error) {
    return (
      <div style={{
        height: typeof height === 'number' ? `${height}px` : height,
        background: 'linear-gradient(135deg, #0d0618, #1a0a2e)',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(139,92,246,0.2)',
        ...containerStyle,
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontFamily: 'Poppins', textAlign: 'center', padding: '0 20px' }}>
          Map loading…<br/><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Nigeria — Lagos, Abuja, Rivers</span>
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', ...containerStyle }}>
      <div
        ref={mapContainer}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          width: '100%',
          borderRadius: typeof containerStyle?.borderRadius === 'string' ? containerStyle.borderRadius : '20px',
          overflow: 'hidden',
          transition: 'opacity 0.5s ease',
          opacity: loaded ? 1 : 0,
        }}
      />
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #0d0618, #1a0a2e)',
          borderRadius: '20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(139,92,246,0.3)', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontFamily: 'Poppins', marginTop: '12px' }}>Loading map…</p>
        </div>
      )}
    </div>
  );
};

export default MapboxMap;
