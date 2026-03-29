import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate }                   from 'react-router-dom';
import api from '../../services/api';
import { formatDateTime } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';

declare const L: any;

const STATUS_COLOURS: Record<string,string> = {
  scheduled:        'bg-blue-100 text-blue-700',
  out_for_delivery: 'bg-yellow-100 text-yellow-700',
  delivered:        'bg-green-100 text-green-700',
  failed:           'bg-red-100 text-red-700',
};

const RDC_COORDS: Record<string,[number,number]> = {
  'North RDC':   [9.6615, 80.0255],
  'South RDC':   [6.0535, 80.2210],
  'East RDC':    [8.5874, 81.2152],
  'West RDC':    [7.2083, 79.8358],
  'Central RDC': [7.2906, 80.6337],
};

// ── Load Leaflet once ──────────────────────────────────────
let leafletReady: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (leafletReady) return leafletReady;
  leafletReady = new Promise(resolve => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (typeof L !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve(); s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return leafletReady;
}

// ── Geocode via Nominatim ──────────────────────────────────
async function geocodeAddress(addr: string): Promise<[number,number]|null> {
  try {
    const q   = encodeURIComponent(addr + ', Sri Lanka');
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const d = await res.json();
    if (!d || !d.length) return null;
    return [parseFloat(d[0].lat), parseFloat(d[0].lon)];
  } catch { return null; }
}

// ── OSRM road route ────────────────────────────────────────
async function getRoute(from:[number,number], to:[number,number]) {
  try {
    const url  = `https://router.project-osrm.org/route/v1/driving/`+
      `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const data = await fetch(url).then(r => r.json());
    if (data.code !== 'Ok') return null;
    const dist = data.routes[0].distance;
    const dur  = data.routes[0].duration;
    return {
      coords: data.routes[0].geometry.coordinates
        .map(([lng,lat]:[number,number]) => [lat,lng] as [number,number]),
      distance: dist >= 1000
        ? `${(dist/1000).toFixed(1)} km` : `${Math.round(dist)} m`,
      duration: dur >= 3600
        ? `${Math.floor(dur/3600)}h ${Math.floor((dur%3600)/60)}m`
        : `${Math.round(dur/60)} min`,
    };
  } catch { return null; }
}

function makeIcon(emoji:string, bg:string, size=44) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${bg};
      border-radius:50%;border:3px solid white;
      box-shadow:0 3px 12px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(size*0.42)}px;">${emoji}</div>`,
    iconSize: [size,size], iconAnchor: [size/2,size/2],
  });
}

export default function GPSTrackingPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();

  const [delivery,   setDelivery]   = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [updating,   setUpdating]   = useState(false);
  const [routeInfo,  setRouteInfo]  = useState<{distance:string;duration:string}|null>(null);
  const [geoStatus,  setGeoStatus]  = useState('');  // geocoding status message

  const mapDivRef       = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const mapInitRef      = useRef(false);
  const rdcMarkerRef    = useRef<any>(null);
  const destMarkerRef   = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const routeLayerRef   = useRef<any>(null);
  const routeDrawnRef   = useRef(false);

  // ── Fetch delivery ─────────────────────────────────────
  const fetchDelivery = useCallback(async () => {
    try {
      const res = await api.get(`/delivery/${id}`);
      setDelivery(res.data.data);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    fetchDelivery();
    const t = setInterval(fetchDelivery, 20000);
    return () => clearInterval(t);
  }, [fetchDelivery]);

  // ── Init map ───────────────────────────────────────────
  const initMap = useCallback(async () => {
    if (mapInitRef.current || !mapDivRef.current) return;
    await loadLeaflet();
    if (mapInitRef.current || !mapDivRef.current) return;
    mapInitRef.current = true;
    mapRef.current = L.map(mapDivRef.current, { center:[7.8731,80.7718], zoom:7 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom:19,
    }).addTo(mapRef.current);
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
  }, []);

  useEffect(() => {
    const t = setTimeout(initMap, 100);
    return () => {
      clearTimeout(t);
      if (mapRef.current) {
        mapRef.current.remove(); mapRef.current = null;
        mapInitRef.current = false; routeDrawnRef.current = false;
      }
      rdcMarkerRef.current    = null;
      destMarkerRef.current   = null;
      driverMarkerRef.current = null;
      routeLayerRef.current   = null;
    };
  }, [initMap]);

  // ── Draw markers + route when delivery loads ───────────
  useEffect(() => {
    if (!mapRef.current || !delivery || routeDrawnRef.current) return;
    routeDrawnRef.current = true;

    const rdcCoords = RDC_COORDS[delivery.rdc_name];

    // RDC marker
    if (rdcCoords && !rdcMarkerRef.current) {
      rdcMarkerRef.current = L.marker(rdcCoords, { icon: makeIcon('🏭','#7c3aed') })
        .addTo(mapRef.current)
        .bindPopup(`<b>🏭 ${delivery.rdc_name}</b><br><small>Origin warehouse</small>`);
    }

    // Resolve destination coords — stored GPS or geocode address
    const resolveDestCoords = async (): Promise<[number,number]|null> => {
      // 1. Stored GPS on order
      if (delivery.delivery_lat && delivery.delivery_lng &&
          Number(delivery.delivery_lat) !== 0 && Number(delivery.delivery_lng) !== 0) {
        return [Number(delivery.delivery_lat), Number(delivery.delivery_lng)];
      }
      // 2. Geocode delivery address
      if (delivery.delivery_address) {
        setGeoStatus('Locating delivery address…');
        const coords = await geocodeAddress(delivery.delivery_address);
        setGeoStatus('');
        if (coords) return coords;
      }
      return null;
    };

    // Determine route origin: driver GPS or RDC
    const fromCoords: [number,number] | undefined =
      delivery.current_lat && delivery.current_lng
        ? [Number(delivery.current_lat), Number(delivery.current_lng)]
        : rdcCoords;

    resolveDestCoords().then(async destCoords => {
      if (!mapRef.current) return;

      // Destination marker
      if (destCoords && !destMarkerRef.current) {
        destMarkerRef.current = L.marker(destCoords, { icon: makeIcon('📦','#16a34a') })
          .addTo(mapRef.current)
          .bindPopup(
            `<b>📦 ${delivery.customer_name}</b><br>
             <small>${delivery.delivery_address || ''}</small>`
          ).openPopup();
      }

      // Draw route
      if (fromCoords && destCoords) {
        const result = await getRoute(fromCoords, destCoords);
        if (!mapRef.current) return;

        if (result) {
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = L.polyline(result.coords, {
            color:'#2563eb', weight:5, opacity:0.85, lineJoin:'round',
          }).addTo(mapRef.current);
          setRouteInfo({ distance: result.distance, duration: result.duration });
          mapRef.current.fitBounds(
            L.latLngBounds([fromCoords, destCoords]),
            { padding:[60,60] }
          );
        } else {
          // Fallback straight line
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = L.polyline([fromCoords, destCoords], {
            color:'#2563eb', weight:3, opacity:0.5, dashArray:'10 8',
          }).addTo(mapRef.current);
          mapRef.current.fitBounds(
            L.latLngBounds([fromCoords, destCoords]),
            { padding:[60,60] }
          );
        }
      } else if (rdcCoords) {
        // No destination — just centre on RDC
        mapRef.current.setView(rdcCoords, 10);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.id, mapRef.current]);

  // ── Update driver marker on GPS refresh ───────────────
  useEffect(() => {
    if (!mapRef.current || !delivery) return;
    if (!delivery.current_lat || !delivery.current_lng) return;
    const pos:[number,number] = [Number(delivery.current_lat), Number(delivery.current_lng)];
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(pos);
    } else {
      driverMarkerRef.current = L.marker(pos, { icon: makeIcon('🚚','#2563eb',46) })
        .addTo(mapRef.current)
        .bindPopup(`<b>🚚 ${delivery.driver_name||'Driver'}</b><br>
          <small>${delivery.last_gps_update ? formatDateTime(delivery.last_gps_update) : ''}</small>`);
    }
  }, [delivery?.current_lat, delivery?.current_lng]);

  // ── Status actions ─────────────────────────────────────
  const advanceStatus = async (newStatus: string) => {
    if (!confirm(`Mark as "${newStatus.replace('_',' ')}"?`)) return;
    setUpdating(true);
    try {
      await api.patch(`/delivery/${id}/status`, { status: newStatus });
      fetchDelivery();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed');
    } finally { setUpdating(false); }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!delivery) return <div className="p-8 text-center text-gray-500">Delivery not found.</div>;

  const hasGPS  = delivery.current_lat && delivery.current_lng;
  const hasDest = (delivery.delivery_lat && Number(delivery.delivery_lat) !== 0)
                || delivery.delivery_address;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => { const r = window.location.pathname; if(r.startsWith('/staff')) navigate('/staff/delivery'); else navigate('/delivery'); }}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold text-gray-900">GPS Tracking</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium
          ${STATUS_COLOURS[delivery.status] || 'bg-gray-100 text-gray-600'}`}>
          {delivery.status.replace('_',' ')}
        </span>

        {/* Route info badges */}
        {routeInfo && (
          <div className="flex gap-2">
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200
                             px-3 py-1 rounded-full font-medium">
              📍 {routeInfo.distance}
            </span>
            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200
                             px-3 py-1 rounded-full font-medium">
              ⏱ {routeInfo.duration}
            </span>
          </div>
        )}

        {/* Geocoding status */}
        {geoStatus && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200
                           px-3 py-1 rounded-full animate-pulse">
            {geoStatus}
          </span>
        )}

        {/* Action buttons */}
        <div className="ml-auto flex gap-2">
          {delivery.status === 'scheduled' && (
            <button onClick={() => advanceStatus('out_for_delivery')}
              disabled={updating}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm
                         font-medium hover:bg-yellow-600 disabled:opacity-50 transition">
              {updating ? '…' : 'Dispatch Now'}
            </button>
          )}
          {delivery.status === 'out_for_delivery' && (<>
            <button onClick={() => advanceStatus('delivered')}
              disabled={updating}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm
                         font-medium hover:bg-green-700 disabled:opacity-50 transition">
              {updating ? '…' : 'Mark Delivered'}
            </button>
            <button onClick={() => advanceStatus('failed')}
              disabled={updating}
              className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm
                         font-medium hover:bg-red-600 disabled:opacity-50 transition">
              Failed
            </button>
          </>)}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Map */}
        <div className="xl:col-span-2 bg-white border border-gray-200
                        rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100
                          flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-gray-700">Live Route Map</h2>
              <span className="text-xs text-gray-400">
                🏭 RDC &nbsp; 📦 Destination
                {hasGPS ? ' &nbsp; 🚚 Driver' : ''}
              </span>
            </div>
            {geoStatus ? (
              <span className="text-xs text-amber-600 bg-amber-50
                               px-2 py-1 rounded-full animate-pulse">
                {geoStatus}
              </span>
            ) : hasGPS ? (
              <span className="text-xs text-green-600 bg-green-50
                               px-2 py-1 rounded-full">
                Live · {formatDateTime(delivery.last_gps_update)}
              </span>
            ) : !hasDest ? (
              <span className="text-xs text-red-500 bg-red-50
                               px-2 py-1 rounded-full">
                No delivery address on order
              </span>
            ) : (
              <span className="text-xs text-blue-600 bg-blue-50
                               px-2 py-1 rounded-full">
                Route: {delivery.rdc_name} → {delivery.customer_name}
              </span>
            )}
          </div>
          <div ref={mapDivRef}
            style={{ height:'480px', width:'100%', background:'#e8f4f8' }}/>
        </div>

        {/* Info panels */}
        <div className="space-y-4">

          {/* Route summary */}
          {routeInfo && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50
                            border border-blue-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-blue-800 mb-3">
                Route Summary
              </h2>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-400">Distance</p>
                  <p className="text-xl font-bold text-blue-600">
                    {routeInfo.distance}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-400">Est. Time</p>
                  <p className="text-xl font-bold text-purple-600">
                    {routeInfo.duration}
                  </p>
                </div>
              </div>
              <p className="text-xs text-blue-700 bg-white rounded-lg p-2">
                🏭 {delivery.rdc_name}
                <span className="mx-1 text-blue-300">→</span>
                📦 {delivery.customer_name}
              </p>
            </div>
          )}

          {/* Order */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Order</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400">Order</p>
                <button onClick={() => navigate(`/orders/${delivery.order_id}`)}
                  className="font-semibold text-blue-600 hover:underline">
                  {delivery.order_number}
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Amount</span>
                <span className="font-semibold">{formatCurrency(delivery.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">RDC</span>
                <span className="text-gray-700">{delivery.rdc_name}</span>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Customer</h2>
            <p className="font-semibold text-gray-800">{delivery.customer_name}</p>
            {delivery.customer_phone && (
              <a href={`tel:${delivery.customer_phone}`}
                className="text-sm text-blue-600 hover:underline block mt-1">
                {delivery.customer_phone}
              </a>
            )}
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              {delivery.delivery_address}
            </p>
            {delivery.delivery_lat && Number(delivery.delivery_lat) !== 0 && (
              <a href={`https://maps.google.com/?q=${delivery.delivery_lat},${delivery.delivery_lng}`}
                target="_blank" rel="noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 block">
                Google Maps →
              </a>
            )}
          </div>

          {/* Driver */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Driver</h2>
            {delivery.driver_name ? (
              <>
                <p className="font-semibold text-gray-800">{delivery.driver_name}</p>
                {delivery.driver_phone && (
                  <a href={`tel:${delivery.driver_phone}`}
                    className="text-sm text-blue-600 hover:underline block mt-1">
                    {delivery.driver_phone}
                  </a>
                )}
                {hasGPS && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400">Live position</p>
                    <p className="text-xs font-mono text-gray-600">
                      {Number(delivery.current_lat).toFixed(5)},
                      {Number(delivery.current_lng).toFixed(5)}
                    </p>
                    <a href={`https://maps.google.com/?q=${delivery.current_lat},${delivery.current_lng}`}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-0.5 block">
                      Google Maps →
                    </a>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-amber-600">No driver assigned</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        Route powered by OSRM · Auto-refreshes every 20s
      </p>
    </div>
  );
}
