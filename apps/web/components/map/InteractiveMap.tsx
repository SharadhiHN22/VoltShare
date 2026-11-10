'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Zap, Navigation, Star, ArrowRight } from 'lucide-react';
import { CHARGER_TYPE_LABELS, CONNECTOR_TYPE_LABELS } from '@voltshare/shared';

interface Charger {
  id: string;
  title: string;
  description?: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  chargerType: string;
  connectorType: string;
  kwRating: number;
  pricePerHour?: number | null;
  pricePerKwh?: number | null;
  avgRating?: number;
  totalReviews?: number;
  distanceKm?: number;
  isAvailable?: boolean;
}

interface InteractiveMapProps {
  chargers: Charger[];
  selectedCharger: Charger | null;
  onSelectCharger: (charger: Charger) => void;
  center: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  zoom?: number;
  userConnectorType?: string;
  userVehicleName?: string;
  onCenterSearch?: () => void;
}

export default function InteractiveMap({
  chargers,
  selectedCharger,
  onSelectCharger,
  center,
  userLocation,
  zoom = 13,
  userConnectorType,
  userVehicleName,
  onCenterSearch,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [id: string]: any }>({});
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const prevUserLocationRef = useRef<string | null>(null);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically import Leaflet to prevent SSR window reference errors
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Inject Leaflet CSS if not already present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Initialize map instance if not already initialized
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [center.lat, center.lng],
          zoom: zoom,
          zoomControl: false,
        });

        // Standard OpenStreetMap tile layer (no API key required)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | Public data &copy; <a href="https://openchargemap.org" target="_blank" rel="noreferrer">Open Charge Map</a>',
          maxZoom: 19,
        }).addTo(map);

        // Add Zoom Control to bottom-right
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Handle real user location marker and accuracy circle
      if (userLocation && userLocation.lat && userLocation.lng) {
        const blueUserIcon = L.divIcon({
          className: 'voltshare-user-gps-marker',
          html: `
            <div style="position: relative; display: flex; items-center; justify-content: center; width: 32px; height: 32px;">
              <span style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: #3b82f6; opacity: 0.45; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
              <span style="position: relative; width: 16px; height: 16px; border-radius: 9999px; background-color: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25);"></span>
              <span style="position: absolute; width: 6px; height: 6px; border-radius: 9999px; background-color: #ffffff; top: 13px; left: 13px;"></span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        const userPopupContent = `
          <div style="font-family: inherit; font-size: 12px; font-weight: 700; color: #1e40af; text-align: center; padding: 2px 4px; line-height: 1.2;">
            You are here
          </div>
        `;

        if (!userMarkerRef.current) {
          userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
            icon: blueUserIcon,
            zIndexOffset: 1000,
          }).addTo(map);
          userMarkerRef.current.bindPopup(userPopupContent);
        } else {
          userMarkerRef.current.setIcon(blueUserIcon);
          userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        }

        // Add or update accuracy circle
        if (userLocation.accuracy && userLocation.accuracy > 0) {
          const displayRadius = Math.min(Math.max(userLocation.accuracy, 15), 5000);
          if (!accuracyCircleRef.current) {
            accuracyCircleRef.current = L.circle([userLocation.lat, userLocation.lng], {
              radius: displayRadius,
              color: '#2563eb',
              weight: 1.5,
              opacity: 0.4,
              fillColor: '#60a5fa',
              fillOpacity: 0.12,
            }).addTo(map);
          } else {
            accuracyCircleRef.current.setLatLng([userLocation.lat, userLocation.lng]);
            accuracyCircleRef.current.setRadius(displayRadius);
          }
        } else if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove();
          accuracyCircleRef.current = null;
        }

        // Center Leaflet map on newly detected user location
        const locKey = `${userLocation.lat.toFixed(6)},${userLocation.lng.toFixed(6)}`;
        if (prevUserLocationRef.current !== locKey) {
          prevUserLocationRef.current = locKey;
          map.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 1.0 });
          userMarkerRef.current.openPopup();
        }
      } else {
        // No user location detected / available: remove user marker and accuracy circle
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove();
          accuracyCircleRef.current = null;
        }
        prevUserLocationRef.current = null;
      }

      // Clear existing charger markers
      Object.values(markersRef.current).forEach((marker: any) => marker.remove());
      markersRef.current = {};

      // Add markers for all chargers
      chargers.forEach((charger) => {
        if (!charger.latitude || !charger.longitude) return;

        const isExternal = (charger as any).source === 'EXTERNAL' || charger.id?.startsWith('ocm-') || (charger as any).isExternal;
        const isDCFast = Number(charger.kwRating) >= 30;
        const isSelected = selectedCharger?.id === charger.id;

        // Distinct marker pin colors:
        // External Public Station: Sky Blue (bg-sky-600)
        // VoltShare DC Fast: Indigo (bg-indigo-600)
        // VoltShare Standard: Emerald (bg-emerald-600)
        const pinColorClass = isExternal
          ? 'bg-sky-600'
          : isDCFast
          ? 'bg-indigo-600'
          : 'bg-emerald-600';
        const ringClass = isSelected ? 'ring-4 ring-emerald-400 ring-offset-2 scale-110' : 'hover:scale-110';

        const customIcon = L.divIcon({
          className: 'voltshare-charger-marker',
          html: `
            <div class="transition-transform duration-200 cursor-pointer flex flex-col items-center">
              <div class="w-9 h-9 ${pinColorClass} text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white ${ringClass}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <div class="w-2 h-2 bg-slate-800 rotate-45 -mt-1 shadow-sm"></div>
              <div class="mt-1 px-1.5 py-0.5 bg-slate-900/90 text-[10px] font-bold text-white rounded-md shadow whitespace-nowrap">
                ${isExternal ? 'Public • ' : ''}${charger.kwRating}kW
              </div>
            </div>
          `,
          iconSize: [36, 48],
          iconAnchor: [18, 48],
          popupAnchor: [0, -48],
        });

        const marker = L.marker([charger.latitude, charger.longitude], {
          icon: customIcon,
        }).addTo(map);

        const priceDisplay = charger.pricePerHour
          ? `₹${Number(charger.pricePerHour).toFixed(0)}/hr`
          : charger.pricePerKwh
          ? `₹${Number(charger.pricePerKwh).toFixed(0)}/kWh`
          : isExternal
          ? 'Pay on site'
          : 'Free';

        const isCompatible = userConnectorType ? charger.connectorType === userConnectorType : null;
        const compatPill = userConnectorType
          ? isCompatible
            ? `<div style="font-size: 10px; font-weight: 700; color: #047857; background: #ecfdf5; padding: 2px 6px; border-radius: 6px; margin-bottom: 6px; border: 1px solid #a7f3d0; text-align: center;">✓ Compatible with ${userVehicleName || 'your EV'}</div>`
            : `<div style="font-size: 10px; font-weight: 700; color: #b45309; background: #fffbeb; padding: 2px 6px; border-radius: 6px; margin-bottom: 6px; border: 1px solid #fde68a; text-align: center;">⚠ Incompatible connector</div>`
          : '';

        const popupContent = isExternal
          ? `
          <div style="font-family: inherit; min-width: 210px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 9999px;">
                Public Station
              </span>
              <span style="font-size: 10px; font-weight: 600; color: #64748b;">
                ${CHARGER_TYPE_LABELS[charger.chargerType] || charger.chargerType}
              </span>
            </div>
            ${compatPill}
            <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 4px 0 2px 0; line-height: 1.2;">
              ${charger.title}
            </h4>
            <div style="font-size: 11px; font-weight: 600; color: #0284c7; margin-bottom: 2px;">
              ${(charger as any).operatorName || (charger as any).hostName || 'Public Network'}
            </div>
            <p style="font-size: 11px; color: #64748b; margin: 0 0 6px 0; line-height: 1.3;">
              ${charger.address || charger.city}
            </p>
            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px; border-top: 1px solid #f1f5f9; margin-bottom: 8px;">
              <span style="font-size: 11px; font-weight: 700; color: #0284c7;">
                ${charger.distanceKm !== undefined ? `${charger.distanceKm} km away` : 'Nearby'}
              </span>
              <span style="font-size: 10px; color: #64748b;">
                ${charger.kwRating} kW • ${CONNECTOR_TYPE_LABELS[charger.connectorType] || charger.connectorType}
              </span>
            </div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${charger.latitude},${charger.longitude}" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; background: #0284c7; color: white; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none;">
              Get Directions ↗
            </a>
            <div style="font-size: 9px; color: #94a3b8; text-align: center; margin-top: 4px;">
              Data: Open Charge Map
            </div>
          </div>
        `
          : `
          <div style="font-family: inherit; min-width: 200px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 700; background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 9999px;">
                ${CHARGER_TYPE_LABELS[charger.chargerType] || charger.chargerType}
              </span>
              <span style="font-size: 11px; font-weight: 700; color: #0f172a;">
                ★ ${Number(charger.avgRating || 0).toFixed(1)}
              </span>
            </div>
            ${compatPill}
            <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 4px 0 2px 0; line-height: 1.2;">
              ${charger.title}
            </h4>
            <p style="font-size: 11px; color: #64748b; margin: 0 0 6px 0; line-height: 1.3;">
              ${charger.address || charger.city}
            </p>
            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px; border-top: 1px solid #f1f5f9; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #047857;">
                ${priceDisplay}
              </span>
              <span style="font-size: 10px; color: #64748b;">
                ${charger.kwRating} kW • ${CONNECTOR_TYPE_LABELS[charger.connectorType] || charger.connectorType}
              </span>
            </div>
            <a href="/chargers/${charger.id}" style="display: block; text-align: center; background: #059669; color: white; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none;">
              Book This Station →
            </a>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on('click', () => {
          onSelectCharger(charger);
        });

        markersRef.current[charger.id] = marker;
      });

      // Fly to selected charger when changed
      if (selectedCharger && markersRef.current[selectedCharger.id]) {
        const marker = markersRef.current[selectedCharger.id];
        map.flyTo([selectedCharger.latitude, selectedCharger.longitude], 15, {
          duration: 0.8,
        });
        marker.openPopup();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [chargers, selectedCharger, center.lat, center.lng, userLocation?.lat, userLocation?.lng, userLocation?.accuracy, zoom, userConnectorType, userVehicleName]);

  const handleRecenter = () => {
    if (onCenterSearch) {
      onCenterSearch();
      return;
    }

    if (userLocation && userLocation.lat && userLocation.lng && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 0.8 });
      userMarkerRef.current?.openPopup();
    } else if (mapInstanceRef.current && center.lat && center.lng) {
      mapInstanceRef.current.flyTo([center.lat, center.lng], 13, { duration: 0.8 });
    }
  };

  return (
    <div className="w-full h-full relative">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px] z-0" />

      {/* Floating Map Controls */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          className="p-2.5 bg-white/95 backdrop-blur shadow-md hover:bg-white text-slate-700 hover:text-emerald-600 rounded-xl border border-slate-200 transition-all font-medium text-xs flex items-center gap-1.5"
          title="Recenter Map"
        >
          <Navigation className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">Center Search</span>
        </button>
      </div>

      {/* Station Count Pill */}
      <div className="absolute bottom-6 left-6 z-[400] bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200 text-xs text-slate-700 font-semibold flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>{chargers.length} Active Stations Displayed</span>
      </div>
    </div>
  );
}
