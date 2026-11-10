'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import ChargerCard from '@/components/charger/ChargerCard';
import ChargerFilters from '@/components/charger/ChargerFilters';
import { MapPin, Navigation, Loader2, Car, AlertCircle } from 'lucide-react';
import { chargerApi, vehicleApi } from '@/lib/api';

// Dynamically load the Leaflet interactive map with SSR disabled
const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-2">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <span className="text-xs font-semibold text-slate-500">Loading interactive map tiles...</span>
    </div>
  ),
});

// Fallback coordinates used strictly for initial map bounds before or if geolocation is unavailable
const FALLBACK_LAT = 12.9716;
const FALLBACK_LNG = 77.5946;

export default function MapDiscoveryPage() {
  const [chargers, setChargers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCharger, setSelectedCharger] = useState<any | null>(null);
  const [userVehicle, setUserVehicle] = useState<any | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchMode, setSearchMode] = useState<'GPS' | 'MANUAL'>('GPS');
  const [searchLocationLabel, setSearchLocationLabel] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const [filters, setFilters] = useState<any>({
    location: '',
    latitude: FALLBACK_LAT,
    longitude: FALLBACK_LNG,
    radius: 15,
    radiusKm: 15,
    chargerType: '',
    connectorType: '',
    maxPrice: '',
    minRating: '',
  });

  const fetchChargers = async () => {
    setLoading(true);
    try {
      const apiParams: any = {
        latitude: filters.latitude,
        longitude: filters.longitude,
        radiusKm: filters.radius || filters.radiusKm || 15,
      };
      if (filters.chargerType) apiParams.chargerType = filters.chargerType;
      if (filters.connectorType) apiParams.connectorType = filters.connectorType;
      if (filters.maxPrice) apiParams.maxPricePerKwh = Number(filters.maxPrice);
      if (filters.minRating) apiParams.minRating = Number(filters.minRating);

      const res = await chargerApi.search(apiParams);
      const list = Array.isArray(res.data) ? res.data : [];
      setChargers(list);
      if (list.length > 0 && !selectedCharger) {
        setSelectedCharger(list[0]);
      }
    } catch (err) {
      console.error('Failed to load chargers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch chargers when coordinates or filters change
  useEffect(() => {
    fetchChargers();
  }, [filters.latitude, filters.longitude, filters.radius, filters.chargerType, filters.connectorType, filters.maxPrice, filters.minRating]);

  // Request browser geolocation
  const requestUserLocation = (isUserInitiated = false) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      if (isUserInitiated) {
        setLocationNotice('Geolocation is not supported by your browser. You can search for chargers manually.');
      }
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        setIsLocating(false);

        // Only update search coordinates if the user didn't manually search for a specific location
        if (isUserInitiated || searchMode !== 'MANUAL') {
          setLocationNotice(null);
          setFilters((prev: any) => ({
            ...prev,
            latitude,
            longitude,
          }));
        }
      },
      (err) => {
        setIsLocating(false);
        if (isUserInitiated) {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationNotice('Location access was denied. You can search for chargers manually.');
          } else if (err.code === err.TIMEOUT) {
            setLocationNotice('Location request timed out. You can search for chargers manually.');
          } else {
            setLocationNotice('Unable to retrieve your location. You can search for chargers manually.');
          }
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  // On page mount: request real user location
  useEffect(() => {
    requestUserLocation(false);
  }, []);

  // Fetch saved vehicle if user is logged in
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('voltshare_token') : null;
    if (token) {
      vehicleApi.list()
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setUserVehicle(res.data[0]);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Near Me: restores browser location search center
  const handleCenterSearch = () => {
    setSearchMode('GPS');
    setSearchLocationLabel(null);
    setLocationNotice(null);
    if (userLocation) {
      setFilters((prev: any) => ({
        ...prev,
        location: '',
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      }));
    } else {
      requestUserLocation(true);
    }
  };

  // Manual location search handler: geocodes query and centers search
  const handleManualLocationSearch = async (query: string) => {
    if (!query || !query.trim()) return;
    setIsGeocoding(true);
    setLocationNotice(null);

    try {
      let geo: { latitude: number; longitude: number; displayName: string } | null = null;
      try {
        const res = await chargerApi.geocode(query.trim());
        if (res.data?.latitude && res.data?.longitude) {
          geo = res.data;
        }
      } catch (apiErr) {
        // Fallback directly to Nominatim
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=1`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          geo = {
            latitude: parseFloat(list[0].lat),
            longitude: parseFloat(list[0].lon),
            displayName: list[0].display_name,
          };
        }
      }

      if (!geo || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude)) {
        setLocationNotice(`Location "${query}" not found. Please try another place.`);
        return;
      }

      setSearchMode('MANUAL');
      setSearchLocationLabel(geo.displayName || query);
      setFilters((prev: any) => ({
        ...prev,
        location: query,
        latitude: geo!.latitude,
        longitude: geo!.longitude,
      }));
    } catch (err: any) {
      setLocationNotice(`Unable to locate "${query}". ${err?.message || ''}`);
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50">
      {/* Left Search & Charger Listing Sidebar */}
      <div className="w-full lg:w-[480px] h-full flex flex-col border-r border-slate-200 bg-white z-10 flex-shrink-0">
        {/* Top Header / Actions (Fixed at top of sidebar) */}
        <div className="p-4 border-b border-slate-200 flex flex-col gap-2 bg-slate-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">EV Stations Nearby</h1>
              <p className="text-xs text-slate-500">
                {searchLocationLabel ? (
                  <span>
                    Near <strong className="text-emerald-700">{searchLocationLabel.split(',')[0]}</strong> &bull; {chargers.length} {chargers.length === 1 ? 'station' : 'stations'} within {filters.radius || 15} km
                  </span>
                ) : (
                  <span>
                    Showing {chargers.length} {chargers.length === 1 ? 'station' : 'stations'} within {filters.radius || 15} km
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleCenterSearch}
              disabled={isLocating}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border disabled:opacity-60 ${
                searchMode === 'GPS'
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
              }`}
              title="Switch back to current GPS location"
            >
              {isLocating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Locating...
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5" /> Near Me
                </>
              )}
            </button>
          </div>

          {/* Active EV Badge */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
            {userVehicle ? (
              <Link
                href="/profile/vehicles"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 transition-colors"
                title="Click to view or manage vehicles"
              >
                <Car className="w-3 h-3 text-emerald-600" />
                <span>My EV: {userVehicle.make} {userVehicle.model} ({userVehicle.connectorType})</span>
              </Link>
            ) : (
              <Link
                href="/profile/vehicles"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 transition-colors"
              >
                <Car className="w-3 h-3" />
                <span>+ Set your EV to highlight compatible chargers</span>
              </Link>
            )}
          </div>
        </div>

        {/* Location Notice Banner (non-blocking) */}
        {locationNotice && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2 flex-shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{locationNotice}</span>
            </div>
            <button
              onClick={() => setLocationNotice(null)}
              className="text-amber-700 hover:text-amber-900 font-bold px-1.5 py-0.5 rounded text-xs hover:bg-amber-100"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter Controls (Fixed header section) */}
        <div className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
          <ChargerFilters
            filters={filters}
            onFilterChange={(newFilters: any) => setFilters(newFilters)}
            onSearch={fetchChargers}
            onLocationSearch={handleManualLocationSearch}
            isGeocoding={isGeocoding}
          />
        </div>

        {/* Independently Scrollable Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 pb-16">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-sm font-medium">Finding stations...</span>
            </div>
          ) : chargers.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-800">No charging stations found</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Try widening your search radius or clearing connector filters.
              </p>
            </div>
          ) : (
            chargers.map((charger) => (
              <div
                key={charger.id}
                onClick={() => setSelectedCharger(charger)}
                className={`cursor-pointer transition-all rounded-xl ${
                  selectedCharger?.id === charger.id
                    ? 'ring-2 ring-emerald-500 shadow-md'
                    : 'hover:shadow-sm'
                }`}
              >
                <ChargerCard
                  charger={charger}
                  userConnectorType={userVehicle?.connectorType}
                  userVehicleName={userVehicle ? `${userVehicle.make} ${userVehicle.model}` : undefined}
                />
              </div>
            ))
          )}
        </div>

        {/* Unobtrusive Data Attribution */}
        <div className="py-2 px-4 border-t border-slate-200 bg-slate-50 text-center text-[10px] text-slate-400 flex-shrink-0">
          VoltShare Community &bull; Public station data provided by{' '}
          <a
            href="https://openchargemap.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-emerald-700 underline"
          >
            Open Charge Map
          </a>
        </div>
      </div>

      {/* Map Interactive Area */}
      <div className="flex-1 min-h-[450px] lg:min-h-full relative bg-slate-100">
        <InteractiveMap
          chargers={chargers}
          selectedCharger={selectedCharger}
          onSelectCharger={(c) => setSelectedCharger(c)}
          center={{
            lat: filters.latitude,
            lng: filters.longitude,
          }}
          userLocation={userLocation}
          onCenterSearch={handleCenterSearch}
          zoom={13}
          userConnectorType={userVehicle?.connectorType}
          userVehicleName={userVehicle ? `${userVehicle.make} ${userVehicle.model}` : undefined}
        />
      </div>
    </div>
  );
}
