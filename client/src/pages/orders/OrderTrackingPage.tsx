import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate }                   from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency }  from '../../utils/formatCurrency';
import { formatDateTime }  from '../../utils/formatDate';

declare const L: any;

// ── RDC coordinates ────────────────────────────────────────
const RDC_COORDS: Record<string,[number,number]> = {
  'North RDC':   [9.6615, 80.0255],
  'South RDC':   [6.0535, 80.2210],
  'East RDC':    [8.5874, 81.2152],
  'West RDC':    [7.2083, 79.8358],
  'Central RDC': [7.2906, 80.6337],
};

const STEPS = ['confirmed','picking','dispatched','delivered'];
const STEP_LABELS: Record<string,string> = {
  confirmed:  'Order Confirmed',
  picking:    'Preparing Your Order',
  dispatched: 'Out for Delivery',
  delivered:  'Delivered',
};
const STEP_DESC: Record<string,string> = {
  confirmed:  'Your order has been confirmed and is being prepared.',
  picking:    'Our staff are picking your items from the warehouse.',
  dispatched: 'Your order is on the way! Track it live on the map.',
  delivered:  'Your order has been delivered. Thank you!',
};
const STEP_ICONS: Record<string,string> = {
  confirmed:  '✅',
  picking:    '📦',
  dispatched: '🚚',
  delivered:  '🎉',
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

// ── Geocode address ────────────────────────────────────────
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
    const url = `https://router.project-osrm.org/route/v1/driving/`+
      `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const data = await fetch(url).then(r => r.json());
    if (data.code !== 'Ok') return null;
    const dist = data.routes[0].distance;
    const dur  = data.routes[0].duration;
    return {
      coords: data.routes[0].geometry.coordinates
        .map(([lng,lat]:[number,number]) => [lat,lng] as [number,number]),
      distance: dist >= 1000 ? `${(dist/1000).toFixed(1)} km` : `${Math.round(dist)} m`,
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

export default function OrderTrackingPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();

  const [order,      setOrder]     = useState<any>(null);
  const [delivery,   setDelivery]  = useState<any>(null);
  const [loading,    setLoading]   = useState(true);
  const [routeInfo,  setRouteInfo] = useState<{distance:string;duration:string}|null>(null);
  const [geoStatus,  setGeoStatus] = useState('');

  const mapDivRef       = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const mapInitRef      = useRef(false);
  const rdcMarkerRef    = useRef<any>(null);
  const destMarkerRef   = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const routeLayerRef   = useRef<any>(null);
  const routeDrawnRef   = useRef(false);

  // ── Fetch order + linked delivery ─────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const ordRes = await api.get(`/orders/${id}`);
      const ord    = ordRes.data.data;
      setOrder(ord);

      // Find the delivery for this order
      try {
        const delRes = await api.get(`/delivery?limit=100`);
        const deliveries: any[] = delRes.data.data?.deliveries || [];
        const linked = deliveries.find(d => d.order_id === ord.id);
        if (linked) setDelivery(linked);
      } catch {}
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 20000);
    return () => clearInterval(t);
  }, [fetchAll]);

  // ── Init map ───────────────────────────────────────────
  const initMap = useCallback(async () => {
    if (mapInitRef.current || !mapDivRef.current) return;
    await loadLeaflet();
    if (mapInitRef.current || !mapDivRef.current) return;
    mapInitRef.current = true;
    mapRef.current = L.map(mapDivRef.current, { center:[7.8731,80.7718], zoom:7 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
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
      rdcMarkerRef.current = null; destMarkerRef.current = null;
      driverMarkerRef.current = null; routeLayerRef.current = null;
    };
  }, [initMap]);

  // ── Draw markers + route once order loads ──────────────
  useEffect(() => {
    if (!mapRef.current || !order || routeDrawnRef.current) return;
    routeDrawnRef.current = true;

    const rdcName   = order.rdc_name || delivery?.rdc_name;
    const rdcCoords = rdcName ? RDC_COORDS[rdcName] : null;

    // RDC marker
    if (rdcCoords && !rdcMarkerRef.current) {
      rdcMarkerRef.current = L.marker(rdcCoords, { icon: makeIcon('🏭','#7c3aed') })
        .addTo(mapRef.current)
        .bindPopup(`<b>🏭 ${rdcName}</b><br><small>Distribution Centre</small>`);
    }

    // Resolve delivery destination coords
    const resolveDestCoords = async (): Promise<[number,number]|null> => {
      if (order.delivery_lat && Number(order.delivery_lat) !== 0)
        return [Number(order.delivery_lat), Number(order.delivery_lng)];
      if (order.delivery_address) {
        setGeoStatus('Locating your delivery address…');
        const coords = await geocodeAddress(order.delivery_address);
        setGeoStatus('');
        return coords;
      }
      return null;
    };

    // From: driver live GPS → RDC if no GPS
    const fromCoords: [number,number] | undefined =
      delivery?.current_lat && delivery?.current_lng
        ? [Number(delivery.current_lat), Number(delivery.current_lng)]
        : rdcCoords || undefined;

    resolveDestCoords().then(async destCoords => {
      if (!mapRef.current) return;

      // Destination (your home) marker
      if (destCoords && !destMarkerRef.current) {
        destMarkerRef.current = L.marker(destCoords, { icon: makeIcon('🏠','#16a34a') })
          .addTo(mapRef.current)
          .bindPopup(
            `<b>🏠 Your delivery address</b><br>
             <small>${order.delivery_address || ''}</small>`
          ).openPopup();
      }

      if (fromCoords && destCoords) {
        const result = await getRoute(fromCoords, destCoords);
        if (!mapRef.current) return;
        if (result) {
          routeLayerRef.current = L.polyline(result.coords, {
            color:'#2563eb', weight:5, opacity:0.85, lineJoin:'round',
          }).addTo(mapRef.current);
          setRouteInfo({ distance: result.distance, duration: result.duration });
          mapRef.current.fitBounds(
            L.latLngBounds([fromCoords, destCoords]),
            { padding:[60,60] }
          );
        } else {
          routeLayerRef.current = L.polyline([fromCoords, destCoords], {
            color:'#2563eb', weight:3, opacity:0.5, dashArray:'10 8',
          }).addTo(mapRef.current);
          mapRef.current.fitBounds(
            L.latLngBounds([fromCoords, destCoords]),
            { padding:[60,60] }
          );
        }
      } else if (rdcCoords) {
        mapRef.current.setView(rdcCoords, 10);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, mapRef.current]);

  // ── Update driver marker on GPS refresh ───────────────
  useEffect(() => {
    if (!mapRef.current || !delivery) return;
    if (!delivery.current_lat || !delivery.current_lng) return;
    const pos:[number,number] = [
      Number(delivery.current_lat),
      Number(delivery.current_lng),
    ];
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(pos);
    } else {
      driverMarkerRef.current = L.marker(pos, { icon: makeIcon('🚚','#2563eb',46) })
        .addTo(mapRef.current)
        .bindPopup(
          `<b>🚚 Your delivery driver</b><br>
           <small>On the way to you!</small>`
        );
    }
  }, [delivery?.current_lat, delivery?.current_lng]);

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading your order…</div>
  );
  if (!order) return (
    <div className="p-8 text-center text-gray-500">Order not found.</div>
  );

  const currentIdx = STEPS.indexOf(order.status);
  const cancelled  = order.status === 'cancelled';
  const hasDriver  = delivery?.driver_name;
  const hasLiveGPS = delivery?.current_lat && delivery?.current_lng;
  const isDispatched = order.status === 'dispatched' || order.status === 'out_for_delivery';
  const showMap    = !cancelled && (isDispatched || order.status === 'picking' || order.status === 'confirmed');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/customer/orders')}
          className="text-gray-400 hover:text-gray-600 text-sm">
          ← My Orders
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Track Order</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          cancelled             ? 'bg-red-100 text-red-700'
          : order.status === 'delivered' ? 'bg-green-100 text-green-700'
          : isDispatched        ? 'bg-yellow-100 text-yellow-700'
          : 'bg-blue-100 text-blue-700'
        }`}>
          {order.status === 'dispatched' ? 'Out for Delivery' : order.status}
        </span>
      </div>

      {/* Order summary card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <p className="text-lg font-bold text-gray-900">{order.order_number}</p>
            <p className="text-sm text-gray-500 mt-0.5">{order.rdc_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Ordered: {formatDateTime(order.ordered_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(order.total)}
            </p>
            {order.delivered_at && (
              <p className="text-xs text-green-600 font-medium mt-0.5">
                Delivered: {formatDateTime(order.delivered_at)}
              </p>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          📍 {order.delivery_address}
        </p>
      </div>

      {/* Cancelled state */}
      {cancelled && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <p className="text-red-700 font-medium">
            This order was cancelled.
          </p>
        </div>
      )}

      {/* Live delivery map — shown when dispatched or picking */}
      {!cancelled && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Live Delivery Map
              </h2>
              <div className="flex gap-2 text-xs text-gray-400">
                <span>🏭 Warehouse</span>
                <span>🏠 Your address</span>
                {hasLiveGPS && <span>🚚 Driver</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {geoStatus && (
                <span className="text-xs text-amber-600 bg-amber-50
                                 px-2 py-1 rounded-full animate-pulse">
                  {geoStatus}
                </span>
              )}
              {hasLiveGPS ? (
                <span className="text-xs text-green-600 bg-green-50
                                 px-2 py-1 rounded-full">
                  🟢 Driver live
                </span>
              ) : routeInfo ? (
                <span className="text-xs text-blue-600 bg-blue-50
                                 px-2 py-1 rounded-full">
                  Route ready
                </span>
              ) : null}
            </div>
          </div>

          {/* Route summary strip */}
          {routeInfo && (
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-100
                            flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 text-lg">📍</span>
                <div>
                  <p className="text-xs text-blue-500">Distance</p>
                  <p className="text-sm font-bold text-blue-700">
                    {routeInfo.distance}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 text-lg">⏱</span>
                <div>
                  <p className="text-xs text-purple-500">Est. Travel Time</p>
                  <p className="text-sm font-bold text-purple-700">
                    {routeInfo.duration}
                  </p>
                </div>
              </div>
              <div className="ml-auto text-xs text-blue-500">
                {order.rdc_name} → Your address
              </div>
            </div>
          )}

          {/* Map */}
          <div ref={mapDivRef}
            style={{ height:'380px', width:'100%', background:'#e8f4f8' }}/>

          {/* Driver info bar */}
          {hasDriver && (
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100
                            flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center
                              justify-center text-lg">🚚</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {delivery.driver_name}
                </p>
                <p className="text-xs text-gray-400">
                  Your delivery driver
                  {delivery.driver_phone && (
                    <a href={`tel:${delivery.driver_phone}`}
                      className="ml-2 text-blue-600 hover:underline">
                      {delivery.driver_phone}
                    </a>
                  )}
                </p>
              </div>
              {hasLiveGPS && (
                <span className="ml-auto text-xs text-green-600
                                 bg-green-100 px-2 py-1 rounded-full">
                  Live GPS active
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400 text-center py-2">
            Map auto-refreshes every 20 seconds
          </p>
        </div>
      )}

      {/* Status timeline */}
      {!cancelled && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-6">
            Delivery Progress
          </h2>
          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const done    = i <= currentIdx;
              const current = i === currentIdx;
              return (
                <div key={step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center
                      justify-center flex-shrink-0 text-base border-2 transition
                      ${done
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-400'}`}>
                      {done ? STEP_ICONS[step] : i + 1}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 h-10
                        ${i < currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`}/>
                    )}
                  </div>
                  <div className="pb-6">
                    <p className={`text-sm font-semibold
                      ${done ? 'text-gray-900' : 'text-gray-400'}`}>
                      {STEP_LABELS[step]}
                      {current && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700
                                         px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </p>
                    <p className={`text-xs mt-0.5 leading-relaxed
                      ${done ? 'text-gray-500' : 'text-gray-300'}`}>
                      {STEP_DESC[step]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Items ordered */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Items Ordered</h2>
        </div>
        {order.items?.length === 0 ? (
          <p className="p-5 text-center text-gray-400 text-sm">No items</p>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {order.items?.map((item: any) => (
                <div key={item.id}
                  className="px-5 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.sku} · Qty {item.quantity} ×{' '}
                      {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">
                    {formatCurrency(item.line_total)}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100
                            flex justify-between items-center">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-gray-900 text-lg">
                {formatCurrency(order.total)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
