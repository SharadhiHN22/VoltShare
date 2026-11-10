'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Car,
  PlusCircle,
  Zap,
  BatteryCharging,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Calendar,
  Hash,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { vehicleApi } from '@/lib/api';
import { getStoredAuth } from '@/lib/auth';
import { CONNECTOR_TYPE_LABELS, ConnectorType, Vehicle } from '@voltshare/shared';

const POPULAR_MAKES = ['Tata', 'MG', 'Hyundai', 'Kia', 'Mahindra', 'BYD', 'BMW', 'Mercedes-Benz', 'Audi', 'Tesla'];

const CONNECTOR_OPTIONS: { value: ConnectorType; label: string; desc: string }[] = [
  { value: ConnectorType.CCS_2, label: 'CCS Combo 2', desc: 'Standard DC Fast in India & Europe (Tata, MG, Hyundai, Mahindra)' },
  { value: ConnectorType.TYPE_2, label: 'Type 2 (Mennekes)', desc: 'Standard AC slow/fast plug in India' },
  { value: ConnectorType.CHADEMO, label: 'CHAdeMO', desc: 'Japanese DC Fast standard (Nissan)' },
  { value: ConnectorType.GB_T, label: 'GB/T', desc: 'Standard DC Fast for commercial fleet EVs' },
  { value: ConnectorType.TESLA, label: 'Tesla Proprietary', desc: 'Tesla standard connector' },
  { value: ConnectorType.TYPE_1, label: 'Type 1 (J1772)', desc: 'North American AC standard' },
  { value: ConnectorType.CCS_1, label: 'CCS Combo 1', desc: 'North American DC combo standard' },
];

export default function VehiclesPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'SEEKER' | 'HOST' | 'ADMIN' | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [make, setMake] = useState('Tata');
  const [customMake, setCustomMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [connectorType, setConnectorType] = useState<ConnectorType>(ConnectorType.CCS_2);
  const [batteryCapacity, setBatteryCapacity] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await vehicleApi.list();
      setVehicles(res.data || []);
      if (res.data && res.data.length === 0) {
        setShowAddForm(true); // Open form if driver has no vehicles yet
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push('/login?redirect=/profile/vehicles');
        return;
      }
      setError(err?.message || 'Failed to load saved vehicles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { role } = getStoredAuth();
    if (role) setUserRole(role);
    fetchVehicles();
  }, []);

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const resolvedMake = make === 'Other' ? customMake.trim() : make.trim();
    if (!resolvedMake) {
      setError('Please provide your vehicle make/brand.');
      return;
    }
    if (!model.trim()) {
      setError('Please enter your vehicle model name.');
      return;
    }

    setSubmitting(true);
    try {
      await vehicleApi.create({
        make: resolvedMake,
        model: model.trim(),
        year: parseInt(year, 10),
        connectorType,
        batteryCapacity: batteryCapacity ? parseFloat(batteryCapacity) : undefined,
        registrationNumber: registrationNumber.trim() ? registrationNumber.trim() : undefined,
      });

      setSuccessMessage('Vehicle successfully saved! Charger compatibility is now enabled.');
      setShowAddForm(false);
      setModel('');
      setBatteryCapacity('');
      setRegistrationNumber('');

      // Refresh list
      const res = await vehicleApi.list();
      setVehicles(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to save vehicle details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (userRole === 'HOST') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">EV Driver Feature Only</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Vehicle profiles are designed for EV Drivers (Seekers) to check connector compatibility and estimate charging duration. As a Host, you manage your charging stations and reservations from the Host Dashboard.
        </p>
        <div className="pt-2">
          <Link href="/dashboard">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              Go to Host Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/map" className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Map
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Car className="w-6 h-6 text-emerald-600" />
            My Electric Vehicles
          </h1>
          <p className="text-sm text-slate-500">
            Save your EV specifications to automatically highlight compatible chargers on the map
          </p>
        </div>

        {!showAddForm && vehicles.length > 0 && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-sm shadow-sm"
          >
            <PlusCircle className="w-4 h-4" /> Add Another Vehicle
          </Button>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Saved Vehicles Cards */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Loading saved vehicles...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {vehicles.length > 0 && (
            <div className="grid gap-4">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-emerald-300 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-slate-900">
                        {v.make} {v.model}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {v.year}
                      </span>
                      <Badge variant="success">
                        Primary Vehicle
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Connector: {CONNECTOR_TYPE_LABELS[v.connectorType] || v.connectorType}</span>
                      </div>

                      {v.batteryCapacity && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <BatteryCharging className="w-3.5 h-3.5 text-slate-400" />
                          <span>{v.batteryCapacity} kWh Battery</span>
                        </div>
                      )}

                      {v.registrationNumber && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Hash className="w-3.5 h-3.5 text-slate-400" />
                          <span>Plate: {v.registrationNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Link href="/map">
                      <Button variant="outline" className="text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                        <Zap className="w-3.5 h-3.5 text-emerald-600" /> Find Compatible Chargers
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Vehicle Form */}
          {showAddForm && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Add Your Electric Vehicle</h2>
                  <p className="text-xs text-slate-500">Enter your EV specs to match compatible charging stations</p>
                </div>
                {vehicles.length > 0 && (
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveVehicle} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Make/Brand */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Vehicle Brand / Make <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {POPULAR_MAKES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      <option value="Other">Other Brand...</option>
                    </select>

                    {make === 'Other' && (
                      <input
                        type="text"
                        placeholder="Enter brand name"
                        value={customMake}
                        onChange={(e) => setCustomMake(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                        required
                      />
                    )}
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Vehicle Model <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Nexon EV, ZS EV, Ioniq 5"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Year */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Model Year <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1990"
                      max={new Date().getFullYear() + 1}
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Battery Capacity */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Battery Capacity (kWh) <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="300"
                      placeholder="e.g. 40.5"
                      value={batteryCapacity}
                      onChange={(e) => setBatteryCapacity(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Registration Plate */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Vehicle Registration Number <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KA 01 EV 1234"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Connector Type Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Charging Connector Port <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {CONNECTOR_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          connectorType === opt.value
                            ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="connectorType"
                          value={opt.value}
                          checked={connectorType === opt.value}
                          onChange={() => setConnectorType(opt.value)}
                          className="mt-1 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                          <div className="text-[11px] text-slate-500 leading-tight">{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  {vehicles.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAddForm(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-sm shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Save Vehicle
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
