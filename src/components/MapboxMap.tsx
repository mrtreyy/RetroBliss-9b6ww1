import React, { useEffect, useRef, useState, useCallback } from 'react';

// PUBLIC token only - no secret keys
const MAPBOX_TOKEN = 'pk.eyJ1IjoicGVhY2U1NDMiLCJhIjoiY21vaHMwYzI2MDc3NjJycXZhdzFsb2ZyeiJ9.9nX4dOizNfUbny-D06iOBQ';

export interface CarMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface MapboxMapProps {
  height?: string | number;
  center?: [number, number];
  zoom?: number;
  markers?: CarMarker[];
  onLocationSelect?: (lat: number, lng: number, placeName: string) => void;
  activeRideRoute?: { pickup: [number, number]; destination: [number, number]; driver?: [number, number] };
  mode?: 'rider' | 'driver' | 'ceo' | 'default';
  onMapLoad?: () => void;
  containerStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}

declare global {
  interface Window {
    mapboxgl: typeof import('mapbox-gl');
  }
}

const MapboxMap: React.FC<MapboxMapProps> = ({
  height = 300,
  center = [8.6753, 9.0820], // Nigeria center
  zoom = 5,
  markers = [],
  onLocationSelect,
  activeRideRoute,
  mode = 'default',
  onMapLoad,
  containerStyle,
  style: extraStyle,
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

      // Load CSS
      if (!document.querySelector('link[href*="mapbox-gl.css"]')) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css';
        document.head.appendChild(cssLink);
      }

      // Load JS
      if (!document.querySelector('script[src*="mapbox-gl.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Mapbox failed to load'));
        document.head.appendChild(script);
      } else {
        // Already loading, wait
        const check = setInterval(() => {
          if (window.mapboxgl) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(check); reject(new Error('Timeout')); }, 10000);
      }
    });
  }, []);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    loadMapboxScripts().then(() => {
      if (!mapContainer.current || mapRef.current) return;

      try {
        window.mapboxgl.accessToken = MAPBOX_TOKEN;

        const map = new window.mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: center,
          zoom: zoom,
          attributionControl: false,
          logoPosition: 'bottom-right',
          fadeDuration: 0,
        });

        mapRef.current = map;

        map.addControl(
          new window.mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
          'top-right'
        );

        map.on('load', () => {
          setLoaded(true);
          onMapLoad?.();
        });

        map.on('error', (e) => {
          console.log('Map error:', e);
          // Don't set error on token errors for public token - it still loads
        });

        if (onLocationSelect) {
          map.on('click', (e) => {
            onLocationSelect(
              e.lngLat.lat,
              e.lngLat.lng,
              `${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`
            );
          });
        }
      } catch (err) {
        console.log('Map init error:', err);
        setError(true);
      }
    }).catch((err) => {
      console.log('Script load error:', err);
      setError(true);
    });

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* ignore */ }
        mapRef.current = null;
        initAttempted.current = false;
      }
    };
  }, []);

  // Update center when prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    try {
      map.flyTo({ center, zoom, duration: 1200, essential: true });
    } catch { /* ignore */ }
  }, [center[0], center[1], zoom]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const newIds = new Set(markers.map(m => m.id));
    markersRef.current.forEach((marker, id) => {
      if (!newIds.has(id) && id !== 'pickup' && id !== 'destination' && id !== 'driver-car') {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    markers.forEach(m => {
      const existing = markersRef.current.get(m.id);
      if (existing) {
        existing.setLngLat([m.lng, m.lat]);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `<div style="font-size:22px;filter:drop-shadow(0 0 6px ${m.color || '#8B5CF6'});line-height:1;" title="${m.label || ''}">🚗</div>`;

        const marker = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([m.lng, m.lat]);

        if (m.label) {
          marker.setPopup(
            new window.mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
              `<p style="font-family:Poppins,sans-serif;font-size:12px;color:white;margin:0;font-weight:500;">${m.label}</p>`
            )
          );
        }
        marker.addTo(map);
        markersRef.current.set(m.id, marker);
      }
    });
  }, [markers, loaded]);

  // Draw active ride route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !activeRideRoute) return;

    const { pickup, destination, driver } = activeRideRoute;

    const tryDraw = () => {
      if (!map.isStyleLoaded()) { setTimeout(tryDraw, 300); return; }

      try {
        // Pickup marker
        if (!markersRef.current.has('pickup')) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="font-size:22px;filter:drop-shadow(0 2px 8px rgba(74,222,128,0.8))">📍</div>';
          const m = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat(pickup).addTo(map);
          markersRef.current.set('pickup', m);
        } else {
          markersRef.current.get('pickup')?.setLngLat(pickup);
        }

        // Destination marker
        if (!markersRef.current.has('destination')) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="font-size:22px;filter:drop-shadow(0 2px 8px rgba(236,72,153,0.8))">🏁</div>';
          const m = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat(destination).addTo(map);
          markersRef.current.set('destination', m);
        } else {
          markersRef.current.get('destination')?.setLngLat(destination);
        }

        // Driver car
        if (driver) {
          if (!markersRef.current.has('driver-car')) {
            const el = document.createElement('div');
            el.innerHTML = '<div style="font-size:28px;filter:drop-shadow(0 0 12px rgba(139,92,246,0.9))">🚗</div>';
            const m = new window.mapboxgl.Marker({ element: el, anchor: 'center' })
              .setLngLat(driver).addTo(map);
            markersRef.current.set('driver-car', m);
          } else {
            markersRef.current.get('driver-car')?.setLngLat(driver);
          }
        }

        // Route line
        const routeData: GeoJSON.Feature = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [pickup, destination] },
        };

        if (map.getSource('route')) {
          (map.getSource('route') as import('mapbox-gl').GeoJSONSource).setData(routeData);
        } else {
          map.addSource('route', { type: 'geojson', data: routeData });
          // Glow layer
          map.addLayer({
            id: 'route-glow',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#8B5CF6', 'line-width': 10, 'line-opacity': 0.2 },
          });
          // Main line
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#8B5CF6', 'line-width': 4, 'line-opacity': 0.9 },
          });
        }

        // Fit to route
        const bounds = new window.mapboxgl.LngLatBounds(pickup, destination);
        map.fitBounds(bounds, { padding: 70, duration: 800, maxZoom: 15 });
      } catch (e) {
        console.log('Route error:', e);
      }
    };

    tryDraw();
  }, [activeRideRoute?.pickup?.join(), activeRideRoute?.destination?.join(), activeRideRoute?.driver?.join(), loaded]);

  const combinedStyle: React.CSSProperties = {
    ...(containerStyle || {}),
    ...(extraStyle || {}),
  };

  const heightPx = typeof height === 'number' ? `${height}px` : height;
  const borderRadius = (combinedStyle.borderRadius as string) || '20px';

  if (error) {
    return (
      <div style={{
        height: heightPx,
        background: 'linear-gradient(135deg, #0d0618 0%, #1a0a2e 50%, #0d1a2e 100%)',
        borderRadius,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(139,92,246,0.2)',
        ...combinedStyle,
      }}>
        <div style={{ fontSize: '48px', marginBottom: '12px', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.5))' }}>🗺️</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontFamily: 'Poppins', textAlign: 'center' }}>
          Map unavailable
        </p>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', fontFamily: 'Poppins', marginTop: '4px' }}>
          Nigeria — Lagos · Abuja · Rivers
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', ...combinedStyle, overflow: 'hidden', borderRadius }}>
      <div
        ref={mapContainer}
        style={{
          height: heightPx,
          width: '100%',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.4s ease',
          borderRadius,
        }}
      />
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #0d0618, #1a0a2e)',
          borderRadius,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}>
          <div style={{ fontSize: '36px', filter: 'drop-shadow(0 0 16px rgba(139,92,246,0.6))' }}>🗺️</div>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(139,92,246,0.25)', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontFamily: 'Poppins', margin: 0 }}>Loading map…</p>
        </div>
      )}
    </div>
  );
};

export default MapboxMap;
