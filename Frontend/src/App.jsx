import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const globalStyles = `
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes gradientPan { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

  body { margin: 0; background-color: #030712; font-family: 'Inter', sans-serif; color: #f8fafc; overflow-x: hidden; }
  .animate-fade-up { animation: fadeUp 0.6s ease-out forwards; }
  
  .dashboard-wrapper { width: 90%; max-width: 1400px; margin: 2rem auto; display: flex; flex-direction: column; gap: 2rem; }
  .glass-card { 
    background: rgba(17, 24, 39, 0.8); 
    backdrop-filter: blur(12px); 
    border: 1px solid rgba(255, 255, 255, 0.1); 
    border-radius: 16px; 
    padding: 1.75rem; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
    position: relative;
    z-index: 9999;
  }  
  .gemini-title { font-size: 3.5rem; font-weight: 800; text-align: center; margin: 0; line-height: 1.35; padding: 0.15em 0; display: inline-block; background: linear-gradient(90deg, #38bdf8, #818cf8, #c084fc, #38bdf8); background-size: 300% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: gradientPan 5s linear infinite; }
  
  .custom-input { width: 100%; padding: 0.9rem 1.2rem; background: rgba(3, 7, 18, 0.7); border: 1px solid #374151; border-radius: 10px; color: #f3f4f6; font-size: 1rem; box-sizing: border-box; transition: border-color 0.2s; }
  .custom-input:focus { outline: none; border-color: #38bdf8; }
  
  .primary-btn { width: 100%; padding: 1rem; background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff; font-weight: 700; font-size: 1rem; border: none; border-radius: 10px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: transform 0.2s, box-shadow 0.2s; }
  .primary-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(37,99,235,0.4); }
  
  .map-wrapper { width: 100%; height: 520px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(56, 189, 248, 0.4); box-shadow: 0 0 35px rgba(56, 189, 248, 0.15); }
  .gmaps-btn { display: inline-block; padding: 1rem 2.5rem; background: #059669; color: #fff; font-weight: 700; border-radius: 10px; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; border: none; cursor: pointer; }
  
  .chip-container { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
  .city-chip { background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; color: #bae6fd; }
  .city-chip button { background: none; border: none; color: #38bdf8; cursor: pointer; font-weight: bold; font-size: 1.1rem; padding: 0; line-height: 1; }
  .city-chip button:hover { color: #f43f5e; }
  
  .autocomplete-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #1e293b; border: 1px solid #334155; border-radius: 8px; margin-top: 0.5rem; max-height: 250px; overflow-y: auto; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
  .suggestion-item { padding: 0.8rem 1rem; cursor: pointer; border-bottom: 1px solid #334155; font-size: 0.9rem; color: #cbd5e1; transition: background 0.2s; }
  .suggestion-item:hover { background: #334155; color: #fff; }
  .suggestion-item:last-child { border-bottom: none; }
`;

// --- NEW COMPONENT: Auto-fits the camera to the drawn route ---
function RouteAutoFitter({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => m.position));
      // Adds a 50px padding so pins don't touch the exact edge of the box
      map.fitBounds(bounds, { padding: [50, 50] }); 
    }
  }, [markers, map]);
  return null;
}

export default function App() {
  const [selectedNodes, setSelectedNodes] = useState(['Delhi', 'Pune', 'Bangalore']);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearchingAPI, setIsSearchingAPI] = useState(false);
  
  const [fleetSize, setFleetSize] = useState(2);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Run Optimization');
  
  const [isOptimized, setIsOptimized] = useState(false);
  const [polylines, setPolylines] = useState([]);
  const [pathMarkers, setPathMarkers] = useState([]);
  const [orderedCities, setOrderedCities] = useState([]);

  // --- NEW AI STATE VARIABLES ---
  const [aiInsights, setAiInsights] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  useEffect(() => {
    if (inputValue.length < 3) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingAPI(true);
      try {
        const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputValue)}&limit=5`);
        setSuggestions(res.data);
      } catch (error) {
        console.error("Geocoding fetch error:", error);
      } finally {
        setIsSearchingAPI(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [inputValue]);

  const addCityTag = (cityName) => {
    if (!selectedNodes.includes(cityName)) {
      setSelectedNodes([...selectedNodes, cityName]);
    }
    setInputValue('');
    setSuggestions([]);
  };

  const removeCityTag = (cityToRemove) => {
    setSelectedNodes(selectedNodes.filter(city => city !== cityToRemove));
  };

  // --- NEW AI GENERATION FUNCTION ---
  const handleGenerateInsights = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await axios.post('http://localhost:5000/api/insights', {
        routes: result.optimized_routes,
        timeSaved: result.estimated_time_saved_minutes,
        distanceSaved: result.distance_saved_km
      });
      setAiInsights(response.data.insights);
    } catch (error) {
      console.error(error);
      alert("Failed to generate insights.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleOptimize = async (e) => {
    e.preventDefault();
    if (selectedNodes.length < 2) {
      alert("Please add at least 2 locations.");
      return;
    }

    setLoading(true);
    setIsOptimized(false);
    setAiInsights(''); // Clears old AI insight when running a new map
    
    const effectiveFleetSize = Math.max(1, Math.min(Number(fleetSize), selectedNodes.length));
    
    try {
      const geocodedNodes = [];
      
      for (let city of selectedNodes) {
        setLoadingText(`Locating: ${city}...`);
        const geoRes = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`);
        
        if (geoRes.data && geoRes.data.length > 0) {
          geocodedNodes.push({
            name: city,
            lat: parseFloat(geoRes.data[0].lat),
            lon: parseFloat(geoRes.data[0].lon)
          });
        } else {
          alert(`Could not find exact coordinates for: "${city}".`);
          setLoading(false); setLoadingText('Run Optimization'); return;
        }
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      setLoadingText("Running Quantum Metaheuristic...");

      const response = await axios.post('http://localhost:5000/api/optimize', {
        nodes: geocodedNodes,
        fleet_size: effectiveFleetSize
      });
      
      setResult(response.data);

      if (response.data.optimized_routes && response.data.optimized_routes.length > 0) {
        let allMarkers = []; let allPolylines = []; let mapPathOrder = [];
        const vehicleColors = ["#38bdf8", "#ec4899", "#a855f7", "#eab308"];

        response.data.optimized_routes.forEach((route, vIdx) => {
          const pathCoords = route.full_nodes.map(n => [n.lat, n.lon]);
          if (pathCoords.length > 1) {
            allPolylines.push({ positions: pathCoords, color: vehicleColors[vIdx % vehicleColors.length] });
          }
          route.full_nodes.forEach((node, idx) => {
            mapPathOrder.push(node.name);
            allMarkers.push({ position: [node.lat, node.lon], label: `Vehicle ${route.vehicle_id} - Stop ${idx + 1}: ${node.name}` });
          });
        });

        setPolylines(allPolylines); setPathMarkers(allMarkers); setOrderedCities(mapPathOrder);
        setIsOptimized(true);
      }
    } catch (error) {
      console.error(error);
      alert(`Optimization request failed.`);
    } finally {
      setLoading(false); setLoadingText('Run Optimization');
    }
  };

  const openInGoogleMaps = () => {
    if (orderedCities.length < 2) return;
    const origin = orderedCities[0];
    const destination = orderedCities[orderedCities.length - 1];
    const waypoints = orderedCities.slice(1, -1).slice(0, 8).join('|'); 
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="dashboard-wrapper">
      <style>{globalStyles}</style>

      <div style={{ textAlign: 'center' }}>
        <h1 className="gemini-title">Traffic Route Optimizer</h1>
        <p style={{ color: '#9ca3af', margin: '0.5rem 0 0 0' }}>Quantum-Inspired Fleet Optimization Engine</p>
      </div>

      <div className="glass-card animate-fade-up">
        <div className="chip-container">
          {selectedNodes.map((city, index) => (
            <div key={index} className="city-chip">
              {city}
              <button type="button" onClick={() => removeCityTag(city)}>×</button>
            </div>
          ))}
        </div>

        <form onSubmit={handleOptimize} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '1.5rem', alignItems: 'end' }}>
          
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontWeight: 600 }}>Add Destinations</label>
            <input 
              type="text" className="custom-input"
              value={inputValue} onChange={(e) => setInputValue(e.target.value)} 
              placeholder="Start typing a city (e.g. Sydney...)"
            />
            
            {suggestions.length > 0 && (
              <div className="autocomplete-dropdown">
                {suggestions.map((s, index) => (
                  <div key={index} className="suggestion-item" onClick={() => addCityTag(s.display_name.split(',')[0])}>
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
            {isSearchingAPI && <div style={{ position: 'absolute', right: '10px', top: '40px', color: '#38bdf8' }}>⏳</div>}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontWeight: 600 }}>Fleet Size</label>
            <input 
              type="number" className="custom-input" min="1" max="20"
              value={fleetSize} onChange={(e) => setFleetSize(Number(e.target.value))} 
            />
          </div>
          <div>
            <button type="submit" className="primary-btn" disabled={loading} style={{ height: '52px', minWidth: '280px' }}>
              {loadingText}
            </button>
          </div>
        </form>
      </div>

      {/* --- DYNAMIC MAP SECTION --- */}
      {isOptimized && (
        <div className="map-wrapper animate-fade-up">
          <MapContainer 
            style={{ height: '100%', width: '100%', backgroundColor: '#aad3df' }}
            minZoom={3} 
            maxBounds={[[-90, -180], [90, 180]]} 
            maxBoundsViscosity={1.0} 
          >
            <TileLayer 
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
              noWrap={true} 
            />
            
            <RouteAutoFitter markers={pathMarkers} />
            
            {pathMarkers.map((m, idx) => <Marker key={idx} position={m.position}><Popup>{m.label}</Popup></Marker>)}
            {polylines.map((line, idx) => <Polyline key={idx} positions={line.positions} color={line.color} weight={5} opacity={0.9} />)}
          </MapContainer>
        </div>
      )}

      {/* --- METRICS & PROOF CARDS --- */}
      {isOptimized && result && result.status === 'success' && (
        <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
          
          {/* THE PROOF SECTION */}
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', textAlign: 'center', marginBottom: '1rem' }}>
            <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>Standard Unoptimized Route (Google Maps Baseline):</span>
            <span style={{ color: '#fff', marginLeft: '10px', fontSize: '1.2rem' }}>{result.baseline_distance_km} km</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            
            <div className="glass-card" style={{ borderTop: '4px solid #38bdf8', textAlign: 'center' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Optimized Fleet Distance</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#38bdf8' }}>
                {result.total_distance_km} <span style={{ fontSize: '1rem' }}>km</span>
              </div>
            </div>

            <div className="glass-card" style={{ borderTop: '4px solid #10b981', textAlign: 'center' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Distance Saved</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                {result.distance_saved_km} <span style={{ fontSize: '1rem' }}>km</span>
              </div>
            </div>

            <div className="glass-card" style={{ borderTop: '4px solid #a855f7', textAlign: 'center' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Driver Time Saved</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#a855f7' }}>
                {result.estimated_time_saved_minutes} <span style={{ fontSize: '1rem' }}>mins</span>
              </div>
            </div>
            
          </div>

          {/* --- AI INSIGHTS SECTION --- */}
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            {!aiInsights ? (
              <button 
                onClick={handleGenerateInsights} 
                disabled={isGeneratingAI}
                style={{ padding: '1rem 2.5rem', background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', color: '#fff', fontWeight: '700', borderRadius: '10px', border: 'none', cursor: 'pointer', transition: 'transform 0.2s' }}
              >
                {isGeneratingAI ? '✨ Analyzing Route Data...' : '✨ Generate AI Dispatch Briefing'}
              </button>
            ) : (
              <div className="glass-card animate-fade-up" style={{ borderLeft: '4px solid #d946ef', textAlign: 'left', padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0, color: '#e879f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>✨</span> AI Dispatch Briefing
                </h3>
                <p style={{ lineHeight: '1.6', color: '#f1f5f9', fontSize: '1.05rem', margin: 0 }}>
                  {aiInsights}
                </p>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem', paddingBottom: '3rem' }}>
            <button onClick={openInGoogleMaps} className="gmaps-btn">📍 Open Route in Google Maps</button>
          </div>
        </div>
      )}
    </div>
  );
}