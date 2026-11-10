import React from 'react';
import Link from 'next/link';
import { MapPin, Zap, CheckCircle2, AlertTriangle, Navigation } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import StarRating from '@/components/ui/StarRating';
import { formatCurrency, formatDistance } from '@/lib/utils';
import { CHARGER_TYPE_LABELS, CONNECTOR_TYPE_LABELS } from '@voltshare/shared';

interface ChargerCardProps {
  charger: {
    id: string;
    title: string;
    chargerType: string;
    connectorType: string;
    pricePerKwh?: number;
    pricePerHour?: number;
    avgRating: number;
    totalReviews: number;
    address: string;
    distanceKm?: number;
    kwRating: number;
    status?: string;
    latitude?: number;
    longitude?: number;
    source?: 'VOLTShare' | 'EXTERNAL';
    isExternal?: boolean;
    operatorName?: string;
    hostName?: string;
  };
  showEditControls?: boolean;
  userConnectorType?: string;
  userVehicleName?: string;
}

export default function ChargerCard({
  charger,
  showEditControls,
  userConnectorType,
  userVehicleName,
}: ChargerCardProps) {
  const isCompatible = userConnectorType ? charger.connectorType === userConnectorType : null;
  const isExternalStation = charger.source === 'EXTERNAL' || charger.id?.startsWith('ocm-') || charger.isExternal;

  return (
    <Card padding="none" hover className="overflow-hidden">
      {/* Image placeholder with subtle color tone based on source */}
      <div
        className={`flex h-40 items-center justify-center ${
          isExternalStation
            ? 'bg-gradient-to-br from-sky-50 to-blue-100 text-sky-400'
            : 'bg-gradient-to-br from-brand-50 to-brand-100 text-brand-300'
        }`}
      >
        <Zap className="h-12 w-12" />
      </div>

      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {/* Source Identification Badge */}
          {isExternalStation ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              Public Station
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              VoltShare
            </span>
          )}

          <Badge variant="info">
            {CHARGER_TYPE_LABELS[charger.chargerType] || charger.chargerType}
          </Badge>
          <Badge variant="neutral">
            {CONNECTOR_TYPE_LABELS[charger.connectorType] || charger.connectorType}
          </Badge>

          {/* Vehicle Compatibility Badge */}
          {userConnectorType && (
            isCompatible ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Compatible with {userVehicleName || 'your EV'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> Incompatible
              </span>
            )
          )}
        </div>

        <h3 className="font-semibold text-gray-900">{charger.title}</h3>

        <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="line-clamp-1">{charger.address}</span>
        </div>

        {charger.distanceKm !== undefined && (
          <p className="mt-0.5 text-xs text-gray-400">
            {formatDistance(charger.distanceKm)} away
          </p>
        )}

        <div className="mt-2">
          {isExternalStation ? (
            <span className="text-xs text-slate-500">
              {charger.operatorName || charger.hostName || 'Public Network'} • Open Charge Map
            </span>
          ) : (
            <>
              <StarRating rating={charger.avgRating} size="sm" />
              <span className="ml-1 text-xs text-gray-400">({charger.totalReviews})</span>
            </>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm">
            {charger.pricePerKwh ? (
              <span className="font-semibold text-gray-900">
                {formatCurrency(charger.pricePerKwh)}/kWh
              </span>
            ) : null}
            {charger.pricePerKwh && charger.pricePerHour && (
              <span className="text-gray-400"> · </span>
            )}
            {charger.pricePerHour ? (
              <span className="text-gray-500">
                {formatCurrency(charger.pricePerHour)}/hr
              </span>
            ) : null}
            {!charger.pricePerKwh && !charger.pricePerHour && (
              <span className="text-xs font-medium text-slate-500">
                {isExternalStation ? 'Public Network • Pay on site' : 'Free'}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-brand-600">
            {charger.kwRating} kW
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          {isExternalStation ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${charger.latitude},${charger.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-sky-700 inline-flex items-center justify-center gap-1.5 shadow-sm"
              title="Get directions on Google Maps"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Get Directions</span>
            </a>
          ) : (
            <>
              <Link
                href={`/chargers/${charger.id}`}
                className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-brand-700 shadow-sm flex items-center justify-center"
              >
                View Details
              </Link>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${charger.latitude},${charger.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-emerald-700 inline-flex items-center justify-center gap-1.5 shadow-sm"
                title="Get directions on Google Maps"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                <span>Get Directions</span>
              </a>
            </>
          )}

          {showEditControls && !isExternalStation && (
            <>
              <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                Edit
              </button>
              <button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50">
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
