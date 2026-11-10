'use client';

import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ChargerType, ConnectorType } from '@voltshare/shared';
import { CHARGER_TYPE_LABELS, CONNECTOR_TYPE_LABELS } from '@voltshare/shared';

export interface FilterState {
  location: string;
  radius: number;
  chargerType: string;
  connectorType: string;
  maxPrice: string;
  minRating: string;
}

interface ChargerFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onSearch: () => void;
  onLocationSearch?: (locationQuery: string) => void;
  isGeocoding?: boolean;
}

export default function ChargerFilters({
  filters,
  onFilterChange,
  onSearch,
  onLocationSearch,
  isGeocoding = false,
}: ChargerFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [locationInput, setLocationInput] = useState(filters.location || '');

  useEffect(() => {
    setLocationInput(filters.location || '');
  }, [filters.location]);

  const update = (key: keyof FilterState, value: string | number) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onLocationSearch && locationInput.trim()) {
      onLocationSearch(locationInput.trim());
    } else {
      onSearch();
    }
  };

  return (
    <div className="space-y-3">
      {/* Manual Location Search Control */}
      <form onSubmit={handleLocationSubmit} className="space-y-1">
        <label className="block text-xs font-semibold text-gray-700">
          Location
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Search Gubbi, Tumakuru..."
              icon={Search}
              value={locationInput}
              onChange={(e) => {
                setLocationInput(e.target.value);
                update('location', e.target.value);
              }}
              className="text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={isGeocoding || !locationInput.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 flex-shrink-0 font-medium h-[38px]"
          >
            {isGeocoding ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching
              </span>
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </form>

      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-left text-xs font-semibold text-gray-700 hover:text-emerald-700 transition-colors"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />
          <span>Filters & Radius Options</span>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
          )}
        </button>

        <Button
          size="sm"
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-2.5 py-1 border border-slate-300"
          onClick={onSearch}
        >
          Apply Filters
        </Button>
      </div>

      {/* Collapsible advanced filters */}
      {isOpen && (
        <div className="space-y-3 pt-2 border-t border-slate-100 transition-all">
          {/* Radius */}
          <div>
            <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
              <span>Search Radius</span>
              <span className="font-semibold text-emerald-600">{filters.radius} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={filters.radius}
              onChange={(e) => update('radius', Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Charger type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Speed / Level
              </label>
              <select
                value={filters.chargerType}
                onChange={(e) => update('chargerType', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Speeds</option>
                {Object.values(ChargerType).map((type) => (
                  <option key={type} value={type}>
                    {CHARGER_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* Connector type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Plug / Connector
              </label>
              <select
                value={filters.connectorType}
                onChange={(e) => update('connectorType', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Connectors</option>
                {Object.values(ConnectorType).map((type) => (
                  <option key={type} value={type}>
                    {CONNECTOR_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Max price */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Max Price (₹/kWh)
              </label>
              <input
                type="number"
                placeholder="Any price"
                value={filters.maxPrice}
                onChange={(e) => update('maxPrice', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Min rating */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Min Rating
              </label>
              <select
                value={filters.minRating}
                onChange={(e) => update('minRating', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Any Rating</option>
                <option value="3">3+ Stars</option>
                <option value="3.5">3.5+ Stars</option>
                <option value="4">4+ Stars</option>
                <option value="4.5">4.5+ Stars</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
