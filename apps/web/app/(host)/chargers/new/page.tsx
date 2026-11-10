'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Zap,
  MapPin,
  Clock,
  DollarSign,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { chargerApi } from '@/lib/api';
import { getStoredAuth } from '@/lib/auth';
import {
  ChargerType,
  ConnectorType,
  CHARGER_TYPE_LABELS,
  CONNECTOR_TYPE_LABELS,
} from '@voltshare/shared';

export default function NewChargerPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('12.9716');
  const [longitude, setLongitude] = useState('77.5946');
  const [chargerType, setChargerType] = useState<ChargerType>(ChargerType.LEVEL_2);
  const [connectorType, setConnectorType] = useState<ConnectorType>(ConnectorType.TYPE_2);
  const [kwRating, setKwRating] = useState('7.4');
  const [pricingType, setPricingType] = useState<'kwh' | 'hour'>('kwh');
  const [price, setPrice] = useState('15.0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'SEEKER' | 'HOST' | 'ADMIN' | null>(null);

  useEffect(() => {
    const { role } = getStoredAuth();
    if (role) setUserRole(role);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('voltshare_token') : null;
    if (!token) {
      router.push('/login?redirect=/chargers/new');
      return;
    }

    try {
      await chargerApi.create({
        title,
        description: description.trim() || undefined,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        chargerType,
        connectorType,
        kwRating: parseFloat(kwRating),
        pricePerKwh: pricingType === 'kwh' ? parseFloat(price) : undefined,
        pricePerHour: pricingType === 'hour' ? parseFloat(price) : undefined,
        availabilityHours: [
          { day: 0, startTime: '06:00', endTime: '22:00' },
          { day: 1, startTime: '06:00', endTime: '22:00' },
          { day: 2, startTime: '06:00', endTime: '22:00' },
          { day: 3, startTime: '06:00', endTime: '22:00' },
          { day: 4, startTime: '06:00', endTime: '22:00' },
          { day: 5, startTime: '06:00', endTime: '22:00' },
          { day: 6, startTime: '06:00', endTime: '22:00' },
        ],
        photoUrls: ['https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800'],
      });

      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to register charger listing.');
    } finally {
      setLoading(false);
    }
  };

  if (userRole === 'SEEKER') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Host Feature Only</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Listing charging stations is reserved for registered Hosts. As an EV driver, you can search and reserve available charging stations across the network.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link href="/map">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              Find Chargers on Map
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">
              Go to Driver Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">List Your EV Charger</h1>
        <p className="text-sm text-slate-500">Provide details about your charging facility to start receiving bookings</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" /> Basic Information
          </h2>

          <Input
            label="Listing Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Indiranagar Safe 11kW Home Charger"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mention parking access, gate instructions, nearby cafes or amenities..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Location */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" /> Location & Coordinates
          </h2>

          <Input
            label="Street Address"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House #, Street, Neighborhood, City"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              type="number"
              step="any"
              required
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              required
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>
        </div>

        {/* Technical Specs & Pricing */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" /> Specifications & Pricing
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Charger Type</label>
              <select
                value={chargerType}
                onChange={(e) => setChargerType(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {Object.values(ChargerType).map((type) => (
                  <option key={type} value={type}>
                    {CHARGER_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Connector</label>
              <select
                value={connectorType}
                onChange={(e) => setConnectorType(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {Object.values(ConnectorType).map((conn) => (
                  <option key={conn} value={conn}>
                    {CONNECTOR_TYPE_LABELS[conn]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Power Rating (kW)"
              type="number"
              step="any"
              required
              value={kwRating}
              onChange={(e) => setKwRating(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Pricing Model</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPricingType('kwh')}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    pricingType === 'kwh'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Per kWh (₹)
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType('hour')}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    pricingType === 'hour'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Per Hour (₹)
                </button>
              </div>
            </div>
          </div>

          <Input
            label={pricingType === 'kwh' ? 'Price per kWh (₹)' : 'Price per Hour (₹)'}
            type="number"
            step="any"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/dashboard">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Publish Listing'}
          </Button>
        </div>
      </form>
    </div>
  );
}
