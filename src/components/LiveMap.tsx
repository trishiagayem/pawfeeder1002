import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Map as MapIcon, Navigation, RefreshCw } from 'lucide-react';

// Fix for Leaflet marker icons in React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to update map view when coordinates change
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

interface LocationData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  timestamp: string;
}

const LiveMap: React.FC = () => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("Listening to all live map updates in 'locations' collection...");
    
    const q = collection(db, "locations");
    const unsub = onSnapshot(q, (snapshot) => {
      const updatedLocations: LocationData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          updatedLocations.push({
            id: doc.id,
            lat: data.lat,
            lng: data.lng,
            name: data.name || doc.id,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
          });
        }
      });

      setLocations(updatedLocations);
      setLoading(false);
      setError(updatedLocations.length === 0 ? "No active locations found." : null);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "locations");
      setError("Permission denied or connection error.");
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="h-[500px] w-full flex flex-col items-center justify-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
        <RefreshCw className="w-8 h-8 animate-spin text-[#6A59CC] mb-2" />
        <p className="text-sm font-bold text-gray-500">Initializing Live GPS Tracker...</p>
      </div>
    );
  }

  // Default center (e.g., Bacolod City) if no locations exist
  const defaultCenter: [number, number] = [10.6386, 122.9511];
  const mapCenter: [number, number] = locations.length > 0 
    ? [locations[0].lat, locations[0].lng] 
    : defaultCenter;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#6A59CC] rounded-2xl shadow-lg shadow-[#6A59CC]/20">
            <MapIcon className="text-white w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#2D3436]">Live GPS Tracker</h3>
            <p className="text-[10px] font-black text-[#7F8C8D] uppercase tracking-widest">Real-time Satellite Feed</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 w-fit">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {locations.length} Active Nodes
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map View */}
        <div className="lg:col-span-3 h-[500px] rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white relative z-0">
          <MapContainer 
            center={mapCenter} 
            zoom={13} 
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {locations.map((loc) => (
              <Marker key={loc.id} position={[loc.lat, loc.lng]}>
                <Popup>
                  <div className="text-center p-1">
                    <p className="font-black text-[#6A59CC] mb-1">{loc.name}</p>
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-mono text-gray-500">{loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}</p>
                      <p className="text-[8px] text-gray-400">Updated: {new Date(loc.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
            {locations.length > 0 && <RecenterMap lat={locations[0].lat} lng={locations[0].lng} />}
          </MapContainer>
        </div>

        {/* Live List Panel */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
          <div className="sticky top-0 bg-[#F8F7FF] dark:bg-[#2D293D] p-2 z-10">
            <p className="text-[10px] font-black text-[#7F8C8D] uppercase tracking-widest">Active Devices</p>
          </div>
          {locations.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-gray-200">
              <Navigation className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-400">No active signals</p>
            </div>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-[#6A59CC]/30 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-sm group-hover:text-[#6A59CC] transition-colors">{loc.name}</p>
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="text-gray-400 uppercase">Lat</span>
                    <span className="text-[#6A59CC] font-bold">{loc.lat.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="text-gray-400 uppercase">Lng</span>
                    <span className="text-[#6A59CC] font-bold">{loc.lng.toFixed(6)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between items-center">
                  <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter">Last Ping</span>
                  <span className="text-[9px] font-bold text-gray-600">{new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
