import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation }                  from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate }     from '../../utils/formatDate';

declare const L: any;

function useBasePath() {
  const loc = useLocation();
  if (loc.pathname.startsWith('/staff')) return '/staff';
  return '';
}

const RDC_COORDS: Record<string,[number,number]> = {
  'North RDC':   [9.6615, 80.0255],
  'South RDC':   [6.0535, 80.2210],
  'East RDC':    [8.5874, 81.2152],
  'West RDC':    [7.2083, 79.8358],
  'Central RDC': [7.2906, 80.6337],
};

const STOP_COLOURS = [
  '#2563eb','#16a34a','#dc2626','#d97706','#7c3aed',
  '#0891b2','#be185d','#059669','#ea580c','#6d28d9',
];

// ── Load Leaflet once, globally ────────────────────────────
let _leafletPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise(resolve => {
    if (!document.getElementById('leaflet-css')) {
      const l = document.createElement('link');
      l.id = 'leaflet-css'; l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    if (typeof L !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return _leafletPromise;
}

// ── Geocode via Nominatim ──────────────────────────────────
async function geocode(addr: string): Promise<[number,number]|null> {
  try {
    const q = encodeURIComponent(addr + ', Sri Lanka');
    const d = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    ).then(r => r.json());
    if (!d?.length) return null;
    return [parseFloat(d[0].lat), parseFloat(d[0].lon)];
  } catch { return null; }
}

// ── OSRM multi-stop route ──────────────────────────────────
async function getMultiStopRoute(pts: [number,number][]) {
  if (pts.length < 2) return null;
  try {
    const coords = pts.map(([lat,lng]) => `${lng},${lat}`).join(';');
    const data = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    ).then(r => r.json());
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

// ── MapPanel — self-contained, always mounted ──────────────
// Never unmounts so Leaflet is initialised exactly once
function MapPanel({
  drawRequest,
  onRouteInfo,
  onMapLoading,
}: {
  drawRequest: { route: any; key: number } | null;
  onRouteInfo: (info: {distance:string;duration:string}|null) => void;
  onMapLoading: (v: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const layersRef    = useRef<any[]>([]);
  const lastKeyRef   = useRef<number>(-1);

  // Init Leaflet once the div is in the DOM
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadLeaflet();
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapRef.current = L.map(containerRef.current, {
        center: [7.8731, 80.7718],
        zoom: 8,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
      // Force tile load
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
      setTimeout(() => mapRef.current?.invalidateSize(), 500);
    })();
    return () => { cancelled = true; };
  }, []);

  // Draw route whenever drawRequest changes
  useEffect(() => {
    if (!drawRequest || !mapRef.current) return;
    if (drawRequest.key === lastKeyRef.current) return;
    lastKeyRef.current = drawRequest.key;

    const map    = mapRef.current;
    const route  = drawRequest.route;

    // Clear old layers
    layersRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
    layersRef.current = [];
    onRouteInfo(null);
    onMapLoading(true);

    // invalidateSize BEFORE drawing
    map.invalidateSize();

    const draw = async () => {
      const rdcCoords = RDC_COORDS[route.rdc_name];

      // RDC marker
      if (rdcCoords) {
        const m = L.marker(rdcCoords, {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:42px;height:42px;background:#7c3aed;
              border-radius:50%;border:3px solid white;
              box-shadow:0 3px 12px rgba(0,0,0,.3);
              display:flex;align-items:center;justify-content:center;
              font-size:18px;">🏭</div>`,
            iconSize:[42,42], iconAnchor:[21,21],
          })
        }).addTo(map)
          .bindPopup(`<b>🏭 ${route.rdc_name}</b><br><small>Starting point</small>`);
        layersRef.current.push(m);
      }

      // Stop markers + collect coords
      const stopCoords: [number,number][] = [];
      for (let i = 0; i < route.stops.length; i++) {
        const stop = route.stops[i];
        let coords: [number,number] | null = null;
        if (stop.delivery_lat && Number(stop.delivery_lat) !== 0) {
          coords = [Number(stop.delivery_lat), Number(stop.delivery_lng)];
        } else if (stop.delivery_address) {
          coords = await geocode(stop.delivery_address);
        }
        if (!coords) continue;
        stopCoords.push(coords);
        const colour = STOP_COLOURS[i % STOP_COLOURS.length];
        const m = L.marker(coords, {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:36px;height:36px;background:${colour};
              border-radius:50%;border:3px solid white;
              box-shadow:0 3px 10px rgba(0,0,0,.3);
              display:flex;align-items:center;justify-content:center;
              color:white;font-weight:bold;font-size:14px;">${i+1}</div>`,
            iconSize:[36,36], iconAnchor:[18,18],
          })
        }).addTo(map)
          .bindPopup(
            `<b>Stop ${i+1}: ${stop.customer_name}</b><br>
             <small>${stop.delivery_address}</small><br>
             <small>${stop.order_number}</small>`
          );
        layersRef.current.push(m);
      }

      // Draw route polyline
      if (rdcCoords && stopCoords.length > 0) {
        const allPts: [number,number][] = [rdcCoords, ...stopCoords];
        const result = await getMultiStopRoute(allPts);

        let poly: any;
        if (result) {
          poly = L.polyline(result.coords, {
            color:'#2563eb', weight:5, opacity:0.85, lineJoin:'round',
          }).addTo(map);
          onRouteInfo({ distance: result.distance, duration: result.duration });
        } else {
          poly = L.polyline(allPts, {
            color:'#2563eb', weight:3, opacity:0.5, dashArray:'8 5',
          }).addTo(map);
        }
        layersRef.current.push(poly);

        // Fit bounds then force tile refresh
        map.fitBounds(L.latLngBounds(allPts), { padding:[50,50] });
        setTimeout(() => map.invalidateSize(), 150);
        setTimeout(() => map.invalidateSize(), 500);
      } else if (rdcCoords) {
        map.setView(rdcCoords, 10);
        setTimeout(() => map.invalidateSize(), 150);
      }

      onMapLoading(false);
    };

    draw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawRequest]);

  return (
    <div
      ref={containerRef}
      style={{ height: '560px', width: '100%', background: '#e8f4f8' }}
    />
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function DeliveryRoutesPage() {
  const navigate = useNavigate();
  const base     = useBasePath();

  const [data,       setData]      = useState<any>(null);
  const [rdcs,       setRdcs]      = useState<any[]>([]);
  const [drivers,    setDrivers]   = useState<any[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [date,       setDate]      = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [rdcId,      setRdcId]     = useState('');
  const [selDriver,  setSelDriver] = useState<string|null>(null);
  const [mapLoading, setMapLoading]= useState(false);
  const [routeInfo,  setRouteInfo] = useState<{distance:string;duration:string}|null>(null);
  const [assigning,  setAssigning] = useState<string|null>(null);

  // drawRequest triggers MapPanel to draw — using a counter key so same
  // driver can be redrawn after data refresh
  const [drawRequest, setDrawRequest] = useState<{route:any;key:number}|null>(null);
  const drawKeyRef = useRef(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelDriver(null);
    setRouteInfo(null);
    setDrawRequest(null);
    try {
      const params: any = { date };
      if (rdcId) params.rdc_id = rdcId;
      const [routeRes, rdcRes, drvRes] = await Promise.all([
        api.get('/delivery/routes/overview', { params }),
        api.get('/rdcs'),
        api.get('/delivery/drivers'),
      ]);
      const newData = routeRes.data.data;
      setData(newData);
      setRdcs(rdcRes.data.data  || []);
      setDrivers(drvRes.data.data || []);

      // Auto-select first driver
      if (newData?.routes?.length > 0) {
        const first = newData.routes[0];
        setSelDriver(first.driver_id);
        drawKeyRef.current += 1;
        setDrawRequest({ route: first, key: drawKeyRef.current });
      }
    } finally { setLoading(false); }
  }, [date, rdcId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelectDriver = (route: any) => {
    const isSelected = selDriver === route.driver_id;
    if (isSelected) {
      setSelDriver(null);
      setDrawRequest(null);
      setRouteInfo(null);
    } else {
      setSelDriver(route.driver_id);
      drawKeyRef.current += 1;
      setDrawRequest({ route, key: drawKeyRef.current });
    }
  };

  const assignDriver = async (deliveryId: string, driverId: string) => {
    setAssigning(deliveryId);
    try {
      await api.patch(`/delivery/${deliveryId}/assign`, { driver_id: driverId });
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to assign driver');
    } finally { setAssigning(null); }
  };

  const routes     = data?.routes     || [];
  const unassigned = data?.unassigned || [];
  const total      = data?.total      || 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <button onClick={() => navigate(`${base}/delivery`)}
            className="text-gray-400 hover:text-gray-600 text-sm mb-1 block">
            ← Delivery
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Delivery Routes
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Plan and visualise driver routes for the day
          </p>
        </div>
        <button onClick={() => navigate(`${base}/delivery/planner`)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm
                     font-medium hover:bg-blue-700 transition">
          🗺 Route Planner
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6
                      flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">RDC</label>
          <select value={rdcId} onChange={e => setRdcId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All RDCs</option>
            {rdcs.map((r:any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {total} delivery{total !== 1 ? 'ies' : ''} · {formatDate(date)}
          </span>
          <button onClick={fetchData}
            className="text-sm border border-gray-300 text-gray-600
                       px-3 py-1.5 rounded-lg hover:bg-gray-50">
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-gray-400">
          <div className="inline-block w-6 h-6 border-2 border-blue-300
                          border-t-blue-600 rounded-full animate-spin mb-3"/>
          <p>Loading routes…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Left — driver list */}
          <div className="xl:col-span-2 space-y-4">

            {/* Unassigned */}
            {unassigned.length > 0 && (
              <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-200
                                flex items-center gap-2">
                  <span className="text-amber-500">⚠️</span>
                  <h2 className="text-sm font-semibold text-amber-800">
                    Unassigned ({unassigned.length})
                  </h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {unassigned.map((d:any) => (
                    <div key={d.id} className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs font-semibold text-gray-800">
                            {d.order_number}
                          </p>
                          <p className="text-xs text-gray-500">{d.customer_name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[180px]">
                            {d.delivery_address}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(d.scheduled_date)}
                        </span>
                      </div>
                      <select
                        defaultValue=""
                        onChange={e => e.target.value && assignDriver(d.id, e.target.value)}
                        disabled={assigning === d.id}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5
                                   text-xs focus:outline-none focus:ring-1 focus:ring-blue-500
                                   disabled:opacity-50 bg-white">
                        <option value="">Assign driver…</option>
                        {drivers.map((drv:any) => (
                          <option key={drv.id} value={drv.id}>
                            {drv.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No deliveries */}
            {routes.length === 0 && unassigned.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl
                              p-10 text-center">
                <p className="text-3xl mb-2">🗺️</p>
                <p className="text-gray-500 font-medium">
                  No deliveries for {formatDate(date)}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Schedule deliveries from the Delivery page
                </p>
              </div>
            )}

            {/* Driver cards */}
            {routes.map((route:any, idx:number) => {
              const isSelected = selDriver === route.driver_id;
              const dotColour  = STOP_COLOURS[idx % STOP_COLOURS.length];
              return (
                <div key={route.driver_id}
                  className={`bg-white border rounded-xl overflow-hidden
                    cursor-pointer transition-all
                    ${isSelected
                      ? 'border-blue-400 shadow-lg ring-2 ring-blue-100'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-md'}`}
                  onClick={() => handleSelectDriver(route)}>

                  {/* Driver header */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center
                                    justify-center text-white font-bold text-sm
                                    flex-shrink-0"
                      style={{ background: dotColour }}>
                      {route.driver_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {route.driver_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {route.rdc_name} · {route.stops.length} stop{route.stops.length !== 1 ? 's' : ''}
                        {route.driver_phone && ` · ${route.driver_phone}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSelected && routeInfo && (
                        <span className="text-xs text-blue-600 bg-blue-50
                                         px-2 py-1 rounded-full hidden sm:block">
                          {routeInfo.distance}
                        </span>
                      )}
                      <span className="text-xs bg-blue-100 text-blue-700
                                       px-2 py-1 rounded-full font-medium">
                        {route.stops.length}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {isSelected ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded stops */}
                  {isSelected && (
                    <div className="border-t border-gray-100">

                      {/* Route summary strip */}
                      {mapLoading && (
                        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100
                                        flex items-center gap-2 text-xs text-blue-600">
                          <div className="w-3 h-3 border border-blue-400
                                          border-t-blue-600 rounded-full animate-spin"/>
                          Drawing route on map…
                        </div>
                      )}
                      {!mapLoading && routeInfo && (
                        <div className="px-4 py-2 bg-green-50 border-b border-green-100
                                        flex gap-4 text-xs">
                          <span className="text-green-700 font-medium">
                            📍 {routeInfo.distance}
                          </span>
                          <span className="text-purple-700 font-medium">
                            ⏱ {routeInfo.duration}
                          </span>
                        </div>
                      )}

                      {/* Stop list */}
                      <div className="divide-y divide-gray-100">
                        {route.stops.map((stop:any, i:number) => (
                          <div key={stop.id}
                            className="px-4 py-3 flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full flex-shrink-0
                                            flex items-center justify-center
                                            text-white text-xs font-bold mt-0.5"
                              style={{ background: STOP_COLOURS[i % STOP_COLOURS.length] }}>
                              {i+1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800">
                                {stop.customer_name}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {stop.delivery_address}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-medium text-blue-600">
                                  {stop.order_number}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {formatCurrency(stop.total)}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full
                                  ${stop.status === 'out_for_delivery'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-blue-100 text-blue-700'}`}>
                                  {stop.status.replace('_',' ')}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                navigate(`${base}/delivery/${stop.id}/track`);
                              }}
                              className="text-xs text-blue-600 hover:underline
                                         flex-shrink-0 mt-0.5">
                              Track
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100
                                      flex justify-between text-xs">
                        <span className="text-gray-500">Total delivery value</span>
                        <span className="font-semibold text-gray-800">
                          {formatCurrency(
                            route.stops.reduce((s:number,st:any) =>
                              s + Number(st.total||0), 0)
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right — map (always mounted, never unmounts) */}
          <div className="xl:col-span-3 bg-white border border-gray-200
                          rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100
                            flex justify-between items-center">
              <h2 className="text-sm font-medium text-gray-700">Route Map</h2>
              {!selDriver ? (
                <span className="text-xs text-gray-400">
                  Click a driver card to see their route
                </span>
              ) : mapLoading ? (
                <span className="text-xs text-blue-600 animate-pulse">
                  Calculating route…
                </span>
              ) : routeInfo ? (
                <span className="text-xs text-green-600 bg-green-50
                                 px-2 py-1 rounded-full font-medium">
                  ✓ {routeInfo.distance} · {routeInfo.duration}
                </span>
              ) : null}
            </div>

            {/* Legend */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100
                            flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <span>🏭 RDC</span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-blue-600
                                 flex items-center justify-center text-white
                                 text-[10px] font-bold">1</span>
                Stop 1
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-green-600
                                 flex items-center justify-center text-white
                                 text-[10px] font-bold">2</span>
                Stop 2
              </span>
              <span className="flex items-center gap-1">
                <div className="w-6 h-0.5 bg-blue-600"/>
                Road route
              </span>
            </div>

            {/* MapPanel stays mounted across all renders */}
            <MapPanel
              drawRequest={drawRequest}
              onRouteInfo={setRouteInfo}
              onMapLoading={setMapLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
