import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate }                               from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';

declare const L: any;

const SL_DISTRICTS: Record<string, Record<string,[number,number]>> = {
  'Western Province':          { 'Colombo':[6.9271,79.8612], 'Gampaha':[7.0917,80.0000], 'Kalutara':[6.5854,79.9607] },
  'Central Province':          { 'Kandy':[7.2906,80.6337], 'Matale':[7.4675,80.6234], 'Nuwara Eliya':[6.9497,80.7891] },
  'Southern Province':         { 'Galle':[6.0535,80.2210], 'Matara':[5.9549,80.5550], 'Hambantota':[6.1241,81.1185], 'Walasmulla':[6.0427,80.2168], 'Tangalle':[6.0242,80.7956] },
  'Northern Province':         { 'Jaffna':[9.6615,80.0255], 'Kilinochchi':[9.3803,80.4036], 'Mannar':[8.9811,79.9044], 'Vavuniya':[8.7514,80.4971], 'Mullaitivu':[9.2671,80.8128] },
  'Eastern Province':          { 'Trincomalee':[8.5874,81.2152], 'Batticaloa':[7.7170,81.6924], 'Ampara':[7.2993,81.6747] },
  'North Western Province':    { 'Kurunegala':[7.4867,80.3647], 'Puttalam':[8.0362,79.8283] },
  'North Central Province':    { 'Anuradhapura':[8.3114,80.4037], 'Polonnaruwa':[7.9403,81.0188] },
  'Uva Province':              { 'Badulla':[6.9934,81.0550], 'Moneragala':[6.8727,81.3497] },
  'Sabaragamuwa Province':     { 'Ratnapura':[6.6828,80.3992], 'Kegalle':[7.2513,80.3464] },
};

const RDC_COORDS: Record<string,[number,number]> = {
  'North RDC':   [9.6615,80.0255],
  'South RDC':   [6.0535,80.2210],
  'East RDC':    [8.5874,81.2152],
  'West RDC':    [7.2083,79.8358],
  'Central RDC': [7.2906,80.6337],
};

let leafletReady: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (leafletReady) return leafletReady;
  leafletReady = new Promise(resolve => {
    if (!document.getElementById('leaflet-css')) {
      const l=document.createElement('link'); l.id='leaflet-css'; l.rel='stylesheet';
      l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    if (typeof L!=='undefined'){resolve();return;}
    const s=document.createElement('script');
    s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload=()=>resolve(); s.onerror=()=>resolve();
    document.head.appendChild(s);
  });
  return leafletReady;
}

async function geocodeAddress(addr: string): Promise<[number,number]|null> {
  try {
    const q   = encodeURIComponent(addr+', Sri Lanka');
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      {headers:{'Accept-Language':'en'}});
    const d   = await res.json();
    if (!d||!d.length) return null;
    return [parseFloat(d[0].lat), parseFloat(d[0].lon)];
  } catch { return null; }
}

async function getRoute(from:[number,number], to:[number,number]) {
  try {
    const url  = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const data = await fetch(url).then(r=>r.json());
    if (data.code!=='Ok') return null;
    const dist = data.routes[0].distance;
    const dur  = data.routes[0].duration;
    return {
      coords: data.routes[0].geometry.coordinates.map(([lng,lat]:[number,number])=>[lat,lng] as [number,number]),
      distance: dist>=1000 ? `${(dist/1000).toFixed(1)} km` : `${Math.round(dist)} m`,
      duration: dur>=3600  ? `${Math.floor(dur/3600)}h ${Math.floor((dur%3600)/60)}m` : `${Math.round(dur/60)} min`,
    };
  } catch { return null; }
}

function makeIcon(emoji:string, bg:string, size=44) {
  return L.divIcon({
    className:'',
    html:`<div style="width:${size}px;height:${size}px;background:${bg};border-radius:50%;border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.42)}px;">${emoji}</div>`,
    iconSize:[size,size], iconAnchor:[size/2,size/2],
  });
}

export default function RouteManagementPage() {
  const navigate = useNavigate();
  const [rdcs,      setRdcs]      = useState<any[]>([]);
  const [orders,    setOrders]    = useState<any[]>([]);
  const [selRdc,    setSelRdc]    = useState('');
  const [mode,      setMode]      = useState<'order'|'district'>('order');
  const [selOrd,    setSelOrd]    = useState('');
  const [selProv,   setSelProv]   = useState('');
  const [selDist,   setSelDist]   = useState('');
  const [routeInfo, setRouteInfo] = useState<{distance:string;duration:string}|null>(null);
  const [status,    setStatus]    = useState('');  // loading message
  const [error,     setError]     = useState('');
  const [destLabel, setDestLabel] = useState('');

  const mapDivRef     = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const mapInitRef    = useRef(false);
  const rdcMarkerRef  = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  useEffect(() => {
    // Load ALL confirmed orders — not filtered by RDC
    Promise.all([
      api.get('/rdcs'),
      api.get('/orders?status=confirmed&limit=200'),
    ]).then(([r, o]) => {
      setRdcs(r.data.data || []);
      setOrders(o.data.data?.orders || []);
    });
  }, []);

  const initMap = useCallback(async () => {
    if (mapInitRef.current || !mapDivRef.current) return;
    await loadLeaflet();
    if (mapInitRef.current || !mapDivRef.current) return;
    mapInitRef.current = true;
    mapRef.current = L.map(mapDivRef.current, {center:[7.8731,80.7718],zoom:7});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom:19,
    }).addTo(mapRef.current);
    setTimeout(()=>mapRef.current?.invalidateSize(),200);
  },[]);

  useEffect(()=>{
    const t=setTimeout(initMap,100);
    return ()=>{
      clearTimeout(t);
      if(mapRef.current){mapRef.current.remove();mapRef.current=null;mapInitRef.current=false;}
      rdcMarkerRef.current=null; destMarkerRef.current=null; routeLayerRef.current=null;
    };
  },[initMap]);

  const clearMap = () => {
    if(rdcMarkerRef.current){mapRef.current?.removeLayer(rdcMarkerRef.current);rdcMarkerRef.current=null;}
    if(destMarkerRef.current){mapRef.current?.removeLayer(destMarkerRef.current);destMarkerRef.current=null;}
    if(routeLayerRef.current){mapRef.current?.removeLayer(routeLayerRef.current);routeLayerRef.current=null;}
    setRouteInfo(null); setError('');
  };

  const drawRoute = async (from:[number,number], to:[number,number], fromLabel:string, toLabel:string) => {
    if(!mapRef.current) return;
    clearMap();
    rdcMarkerRef.current  = L.marker(from,{icon:makeIcon('🏭','#7c3aed')}).addTo(mapRef.current).bindPopup(`<b>🏭 ${fromLabel}</b>`).openPopup();
    destMarkerRef.current = L.marker(to,  {icon:makeIcon('📍','#dc2626')}).addTo(mapRef.current).bindPopup(`<b>📍 ${toLabel}</b>`);
    const result = await getRoute(from, to);
    if(result){
      routeLayerRef.current = L.polyline(result.coords,{color:'#2563eb',weight:5,opacity:.85,lineJoin:'round'}).addTo(mapRef.current);
      setRouteInfo({distance:result.distance,duration:result.duration});
      mapRef.current.fitBounds(L.latLngBounds([from,to,...result.coords.slice(0,8),...result.coords.slice(-8)]),{padding:[50,50]});
    } else {
      routeLayerRef.current = L.polyline([from,to],{color:'#2563eb',weight:3,opacity:.5,dashArray:'10 8'}).addTo(mapRef.current);
      mapRef.current.fitBounds(L.latLngBounds([from,to]),{padding:[60,60]});
      setError('Road routing unavailable — showing straight line.');
    }
  };

  const handleShowRoute = async () => {
    setError(''); setStatus('');

    // ── Validate RDC ──
    if (!selRdc) return setError('Please select an RDC (origin).');
    const rdc       = rdcs.find(r => String(r.id) === selRdc);
    const fromCoords = rdc ? RDC_COORDS[rdc.name] : null;
    if (!fromCoords) return setError(`Coordinates not found for ${rdc?.name}. Check RDC name matches exactly.`);

    // ── By District ──
    if (mode === 'district') {
      if (!selProv) return setError('Please select a province.');
      if (!selDist) return setError('Please select a district.');
      const toCoords = SL_DISTRICTS[selProv]?.[selDist];
      if (!toCoords) return setError('District coordinates not found.');
      setStatus('Calculating route…');
      setDestLabel(`${selDist}, ${selProv}`);
      await drawRoute(fromCoords, toCoords, rdc!.name, `${selDist}, ${selProv}`);
      setStatus('');
      return;
    }

    // ── By Order ──
    if (!selOrd) return setError('Please select an order.');
    const ord = orders.find(o => o.id === selOrd);
    if (!ord)  return setError('Order not found.');
    const label = `${ord.order_number} — ${ord.customer_name}`;
    setDestLabel(label);

    // 1. Stored GPS
    if (ord.delivery_lat && ord.delivery_lng &&
        Number(ord.delivery_lat) !== 0 && Number(ord.delivery_lng) !== 0) {
      setStatus('Calculating route…');
      await drawRoute(fromCoords, [Number(ord.delivery_lat), Number(ord.delivery_lng)], rdc!.name, label);
      setStatus('');
      return;
    }

    // 2. Geocode address
    if (ord.delivery_address) {
      setStatus('Geocoding address…');
      const geocoded = await geocodeAddress(ord.delivery_address);
      if (geocoded) {
        setStatus('Calculating route…');
        await drawRoute(fromCoords, geocoded, rdc!.name, label);
        setStatus('');
        return;
      }
    }

    // 3. Failed
    setStatus('');
    setError(`Could not locate "${ord.delivery_address||'this address'}". Switch to District mode and pick manually.`);
  };

  const selRdcObj  = rdcs.find(r => String(r.id) === selRdc);
  const selOrdObj  = orders.find(o => o.id === selOrd);
  const isBusy     = status !== '';

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { if(window.location.pathname.startsWith('/staff')) navigate('/staff/delivery'); else navigate('/delivery'); }}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h1 className="text-2xl font-semibold text-gray-900">Route Planner</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* ── Left panel ─────────────────────────────── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Step 1 — RDC */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 bg-purple-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
              <h2 className="text-sm font-semibold text-gray-700">Select RDC (Origin)</h2>
            </div>
            <select value={selRdc}
              onChange={e => { setSelRdc(e.target.value); clearMap(); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Choose RDC…</option>
              {rdcs.map((r:any) => (
                <option key={r.id} value={r.id}>{r.name} ({r.region})</option>
              ))}
            </select>
            {selRdcObj && RDC_COORDS[selRdcObj.name] && (
              <p className="text-xs text-purple-500 mt-1.5 flex items-center gap-1">
                <span>🏭</span>
                {selRdcObj.name} · {RDC_COORDS[selRdcObj.name][0].toFixed(3)}, {RDC_COORDS[selRdcObj.name][1].toFixed(3)}
              </p>
            )}
          </div>

          {/* Step 2 — Destination */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
              <h2 className="text-sm font-semibold text-gray-700">Destination</h2>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
              {(['order','district'] as const).map(m => (
                <button key={m}
                  onClick={() => { setMode(m); setSelOrd(''); setSelProv(''); setSelDist(''); clearMap(); }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition
                    ${mode===m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {m==='order' ? '📦 By Order' : '🗺 By District'}
                </button>
              ))}
            </div>

            {/* ── By Order ── */}
            {mode === 'order' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Select Order
                  <span className="text-gray-400 ml-1">({orders.length} confirmed)</span>
                </label>
                <select value={selOrd}
                  onChange={e => { setSelOrd(e.target.value); clearMap(); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select order…</option>
                  {orders.map((o:any) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.customer_name}
                    </option>
                  ))}
                </select>

                {/* Order info card */}
                {selOrdObj && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-blue-800">{selOrdObj.order_number}</p>
                    <p className="text-blue-700">{selOrdObj.customer_name}</p>
                    {selOrdObj.delivery_address && (
                      <p className="text-blue-600">📍 {selOrdObj.delivery_address}</p>
                    )}
                    <p className="text-blue-500 font-medium">{formatCurrency(selOrdObj.total)}</p>
                    <div className="pt-1 border-t border-blue-200">
                      {selOrdObj.delivery_lat && Number(selOrdObj.delivery_lat) !== 0 ? (
                        <p className="text-green-600 font-medium">✓ GPS stored — instant route</p>
                      ) : selOrdObj.delivery_address ? (
                        <p className="text-amber-600">⚡ Will geocode address automatically</p>
                      ) : (
                        <p className="text-red-500">✗ No address — use District mode</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── By District ── */}
            {mode === 'district' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Province</label>
                  <select value={selProv}
                    onChange={e => { setSelProv(e.target.value); setSelDist(''); clearMap(); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select province…</option>
                    {Object.keys(SL_DISTRICTS).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                {selProv && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">District / City</label>
                    <select value={selDist}
                      onChange={e => { setSelDist(e.target.value); clearMap(); }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select district…</option>
                      {Object.keys(SL_DISTRICTS[selProv]||{}).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    {selDist && (
                      <p className="text-xs text-gray-400 mt-1">
                        📍 {SL_DISTRICTS[selProv][selDist]?.[0].toFixed(4)}, {SL_DISTRICTS[selProv][selDist]?.[1].toFixed(4)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Show Route button */}
          <button onClick={handleShowRoute} disabled={isBusy || !selRdc}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold
                       hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {isBusy ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {status}
              </>
            ) : '🗺 Show Route'}
          </button>

          {/* Route result */}
          {routeInfo && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">Route Summary</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-400">Distance</p>
                  <p className="text-xl font-bold text-blue-600">{routeInfo.distance}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-400">Est. Time</p>
                  <p className="text-xl font-bold text-purple-600">{routeInfo.duration}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-2 text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
                <span className="text-purple-600">🏭</span>
                <span className="font-medium">{selRdcObj?.name}</span>
                <span className="text-gray-300">→</span>
                <span className="text-red-600">📍</span>
                <span className="truncate">{destLabel}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-xs leading-relaxed">{error}</p>
              {mode==='order' && (
                <button onClick={() => { setMode('district'); setError(''); }}
                  className="mt-2 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 w-full transition">
                  Switch to District Mode →
                </button>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-600 mb-2">Map Legend</h3>
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-2"><span>🏭</span><span>RDC — origin</span></div>
              <div className="flex items-center gap-2"><span>📍</span><span>Destination</span></div>
              <div className="flex items-center gap-2"><div className="w-6 h-1 bg-blue-600 rounded"/><span>Road route</span></div>
              <div className="flex items-center gap-2"><div className="w-6 h-0.5 border-t-2 border-dashed border-blue-400"/><span>Straight (fallback)</span></div>
            </div>
          </div>
        </div>

        {/* ── Map ────────────────────────────────────── */}
        <div className="xl:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">Route Map — Sri Lanka</h2>
            {isBusy && (
              <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full animate-pulse">
                {status}
              </span>
            )}
            {routeInfo && !isBusy && (
              <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full">
                ✓ {routeInfo.distance} · {routeInfo.duration}
              </span>
            )}
          </div>
          <div ref={mapDivRef} style={{height:'600px',width:'100%',background:'#e8f4f8'}}/>
        </div>
      </div>
    </div>
  );
}
