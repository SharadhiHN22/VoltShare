'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Zap,
  MapPin,
  Star,
  Clock,
  ShieldCheck,
  Calendar,
  CreditCard,
  User,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Car,
  Battery,
  BatteryCharging,
  Info,
  Navigation,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import StarRating from '@/components/ui/StarRating';
import { chargerApi, bookingApi, vehicleApi, reviewApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CHARGER_TYPE_LABELS, CONNECTOR_TYPE_LABELS } from '@voltshare/shared';

export default function ChargerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [charger, setCharger] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [currentBattery, setCurrentBattery] = useState<number>(20);
  const [targetBattery, setTargetBattery] = useState<number>(80);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking Form State
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState('10:00');
  const [durationHours, setDurationHours] = useState(2);
  const [notes, setNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchCharger = async () => {
      setLoading(true);
      try {
        const res = await chargerApi.getById(id);
        setCharger(res.data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load charger details.');
      } finally {
        setLoading(false);
      }
    };
    fetchCharger();

    // Fetch reviews for this charger
    setReviewsLoading(true);
    reviewApi
      .getByCharger(id)
      .then((res) => {
        setReviews(res.data || []);
      })
      .catch(() => {
        setReviews([]);
      })
      .finally(() => {
        setReviewsLoading(false);
      });

    // Fetch saved vehicles for driver
    const token = typeof window !== 'undefined' ? localStorage.getItem('voltshare_token') : null;
    if (token) {
      vehicleApi
        .list()
        .then((res) => {
          const list = res.data || [];
          setVehicles(list);
          if (list.length > 0) {
            setSelectedVehicleId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-sm text-slate-500 font-medium">Loading charger details...</span>
      </div>
    );
  }

  if (error || !charger) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{error || 'Charger not found'}</h2>
        <Link href="/map">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Map
          </Button>
        </Link>
      </div>
    );
  }

  // Selected vehicle & battery calculation
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;
  const isCompatible = selectedVehicle ? selectedVehicle.connectorType === charger.connectorType : null;

  // Validation
  let batteryValidationMessage: string | null = null;
  if (selectedVehicle) {
    if (isNaN(currentBattery) || currentBattery < 0 || currentBattery > 100) {
      batteryValidationMessage = 'Starting battery must be between 0% and 100%.';
    } else if (isNaN(targetBattery) || targetBattery < 0 || targetBattery > 100) {
      batteryValidationMessage = 'Target battery must be between 0% and 100%.';
    } else if (targetBattery <= currentBattery) {
      batteryValidationMessage = 'Target battery % must be greater than starting battery %.';
    }
  }

  const hasBatteryCapacity = Boolean(selectedVehicle && selectedVehicle.batteryCapacity && Number(selectedVehicle.batteryCapacity) > 0);
  const batteryCapacity = hasBatteryCapacity ? Number(selectedVehicle.batteryCapacity) : null;

  // Vehicle-aware energy & time calculations
  let energyRequiredKwh: number | null = null;
  let estimatedChargingTimeHours: number | null = null;
  let estimatedCost = 0;

  if (hasBatteryCapacity && batteryCapacity && !batteryValidationMessage) {
    const batteryFraction = (targetBattery - currentBattery) / 100;
    energyRequiredKwh = parseFloat((batteryCapacity * batteryFraction).toFixed(2));

    const kwRating = Number(charger.kwRating || 0);
    if (kwRating > 0) {
      estimatedChargingTimeHours = energyRequiredKwh / kwRating;
    }

    if (charger.pricePerKwh) {
      estimatedCost = parseFloat((energyRequiredKwh * Number(charger.pricePerKwh)).toFixed(2));
    } else if (charger.pricePerHour) {
      estimatedCost = parseFloat((durationHours * Number(charger.pricePerHour)).toFixed(2));
    }
  } else {
    // Fallback when battery capacity is not specified or no vehicle selected
    if (charger.pricePerHour) {
      estimatedCost = parseFloat((durationHours * Number(charger.pricePerHour)).toFixed(2));
    } else if (charger.pricePerKwh) {
      const fallbackKwh = Number(charger.kwRating || 0) * durationHours;
      estimatedCost = parseFloat((fallbackKwh * Number(charger.pricePerKwh)).toFixed(2));
    }
  }

  // Format estimated charging duration
  let formattedChargingTime = '';
  if (estimatedChargingTimeHours !== null) {
    const totalMinutes = Math.round(estimatedChargingTimeHours * 60);
    if (totalMinutes < 60) {
      formattedChargingTime = `~${totalMinutes} mins`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      formattedChargingTime = minutes > 0 ? `~${hours} hr ${minutes} mins` : `~${hours} hrs`;
    }
  }

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batteryValidationMessage) {
      setBookingError(batteryValidationMessage);
      return;
    }

    setBookingLoading(true);
    setBookingError(null);
    setBookingSuccess(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('voltshare_token') : null;
    if (!token) {
      router.push(`/login?redirect=/chargers/${id}`);
      return;
    }

    try {
      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000);

      await bookingApi.create({
        chargerId: id,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        notes: notes.trim() || undefined,
        vehicleId: selectedVehicleId || undefined,
        currentBattery: hasBatteryCapacity ? currentBattery : undefined,
        targetBattery: hasBatteryCapacity ? targetBattery : undefined,
      });

      setBookingSuccess('Slot booked successfully! Redirecting to your reservations...');
      setTimeout(() => {
        router.push('/bookings');
      }, 1500);
    } catch (err: any) {
      setBookingError(err?.message || 'Failed to book slot. This time slot might already be reserved.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Back button */}
      <Link href="/map" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Map Search
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details & Specs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  {CHARGER_TYPE_LABELS[charger.chargerType] || charger.chargerType}
                </Badge>
                <Badge variant="info">
                  {CONNECTOR_TYPE_LABELS[charger.connectorType] || charger.connectorType}
                </Badge>
                {charger.isPublicStation && (
                  <Badge variant="neutral">Public Station</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{Number(charger.avgRating || 0).toFixed(1)}</span>
                <span className="text-slate-400 font-normal">({charger.totalReviews || 0} reviews)</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{charger.title}</h1>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>{charger.address}</span>
              </div>
              {charger.latitude && charger.longitude && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${charger.latitude},${charger.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors w-fit flex-shrink-0 shadow-sm"
                  title="Open navigation in Google Maps"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Get Directions</span>
                </a>
              )}
            </div>

            {/* Vehicle Compatibility Banner */}
            {selectedVehicle && (
              <div
                className={`mt-4 p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-semibold ${
                  isCompatible
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isCompatible ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  )}
                  <span>
                    {isCompatible
                      ? `✓ Compatible with your ${selectedVehicle.make} ${selectedVehicle.model} (${CONNECTOR_TYPE_LABELS[selectedVehicle.connectorType] || selectedVehicle.connectorType})`
                      : `⚠ Incompatible: Station provides ${CONNECTOR_TYPE_LABELS[charger.connectorType] || charger.connectorType}, but your ${selectedVehicle.make} ${selectedVehicle.model} requires ${CONNECTOR_TYPE_LABELS[selectedVehicle.connectorType] || selectedVehicle.connectorType}.`}
                  </span>
                </div>
                <Link
                  href="/profile/vehicles"
                  className="underline font-normal text-[11px] text-slate-500 hover:text-slate-700 whitespace-nowrap"
                >
                  Manage Vehicles
                </Link>
              </div>
            )}

            {charger.description && (
              <p className="text-sm text-slate-600 border-t border-slate-100 pt-4 leading-relaxed">
                {charger.description}
              </p>
            )}
          </div>

          {/* Technical Specifications */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Charger Specifications</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500 font-medium">Power Rating</span>
                <div className="text-base font-bold text-slate-900 mt-1">{charger.kwRating} kW</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500 font-medium">Connector</span>
                <div className="text-base font-bold text-slate-900 mt-1">
                  {CONNECTOR_TYPE_LABELS[charger.connectorType] || charger.connectorType}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500 font-medium">Pricing Model</span>
                <div className="text-base font-bold text-emerald-700 mt-1">
                  {charger.pricePerKwh ? `${formatCurrency(charger.pricePerKwh)}/kWh` : `${formatCurrency(charger.pricePerHour)}/hr`}
                </div>
              </div>
            </div>
          </div>

          {/* Host Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{charger.host?.name || 'Verified Host'}</h3>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" /> Identity Verified Host
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              Community Member since 2026
            </div>
          </div>

          {/* Rating & Reviews Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Rating & Reviews</h2>
                <p className="text-xs text-slate-500">Verified reviews from drivers who completed charging sessions</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-3xl font-extrabold text-slate-900">
                  {Number(charger.avgRating || 0).toFixed(1)}
                </div>
                <div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const rating = Number(charger.avgRating || 0);
                      const filled = s <= Math.floor(rating);
                      const half = !filled && s - 0.5 <= rating;
                      return (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            filled || half ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    {charger.totalReviews > 0 ? `(${charger.totalReviews} ${charger.totalReviews === 1 ? 'review' : 'reviews'})` : 'No reviews yet'}
                  </div>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            {reviewsLoading ? (
              <div className="py-8 flex items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-xs">Loading reviews...</span>
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-1">
                <Star className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">No reviews yet</p>
                <p className="text-xs text-slate-400">Be the first EV driver to review this charging station after your session!</p>
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-slate-100">
                {reviews.map((rev) => (
                  <div key={rev.id} className="pt-4 first:pt-0 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs uppercase">
                          {rev.reviewer?.name ? rev.reviewer.name.charAt(0) : 'U'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {rev.reviewer?.name || 'EV Driver'}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                                }`}
                              />
                            ))}
                            <span className="text-[11px] font-semibold text-slate-600 ml-1">{rev.rating}/5</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400">{formatDate(rev.createdAt)}</span>
                    </div>
                    {rev.comment && (
                      <p className="text-xs text-slate-600 leading-relaxed pl-10">
                        "{rev.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Booking Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-20 space-y-6">
            <div>
              <span className="text-xs uppercase tracking-wide font-semibold text-slate-500">Slot Reservation</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {charger.pricePerKwh ? `${formatCurrency(charger.pricePerKwh)} / kWh` : `${formatCurrency(charger.pricePerHour)} / hr`}
              </div>
            </div>

            {bookingSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{bookingSuccess}</span>
              </div>
            )}

            {bookingError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            <form onSubmit={handleBooking} className="space-y-4">
              {/* Vehicle Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Select Your EV</label>
                  <Link
                    href="/profile/vehicles"
                    className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    + Manage Vehicles
                  </Link>
                </div>
                {vehicles.length > 0 ? (
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.make} {v.model} ({v.batteryCapacity ? `${v.batteryCapacity} kWh, ` : ''}{CONNECTOR_TYPE_LABELS[v.connectorType] || v.connectorType})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-700">No saved vehicle profile</p>
                    <p className="text-slate-500">
                      <Link href="/profile/vehicles" className="text-emerald-600 font-semibold underline">
                        Add your EV
                      </Link>{' '}
                      to enable vehicle-aware charging duration and energy estimates.
                    </p>
                  </div>
                )}
              </div>

              {/* Battery Levels (Shown when a vehicle is selected) */}
              {selectedVehicle && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <BatteryCharging className="w-4 h-4 text-emerald-600" /> Battery Charging Target
                    </span>
                    {hasBatteryCapacity ? (
                      <span className="text-[11px] text-slate-500 font-medium">{batteryCapacity} kWh pack</span>
                    ) : (
                      <span className="text-[11px] text-amber-600 font-medium">Capacity not specified</span>
                    )}
                  </div>

                  {hasBatteryCapacity ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Starting Battery %
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={currentBattery}
                              onChange={(e) => setCurrentBattery(parseInt(e.target.value, 10) || 0)}
                              className="w-full rounded-lg border border-slate-300 p-2 text-sm pr-7 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-medium">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Target Battery %
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={targetBattery}
                              onChange={(e) => setTargetBattery(parseInt(e.target.value, 10) || 0)}
                              className="w-full rounded-lg border border-slate-300 p-2 text-sm pr-7 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-medium">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 font-medium">Quick presets:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentBattery(20);
                            setTargetBattery(80);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            currentBattery === 20 && targetBattery === 80
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          20% → 80% (Recommended)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentBattery(10);
                            setTargetBattery(100);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            currentBattery === 10 && targetBattery === 100
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          10% → 100%
                        </button>
                      </div>

                      {batteryValidationMessage && (
                        <p className="text-xs text-rose-600 font-medium mt-1">
                          ⚠ {batteryValidationMessage}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 space-y-1">
                      <p>
                        Battery capacity is not specified for {selectedVehicle.make} {selectedVehicle.model}.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Cost will be estimated based on standard slot duration. You can edit your vehicle in{' '}
                        <Link href="/profile/vehicles" className="text-emerald-600 underline">
                          My Vehicles
                        </Link>{' '}
                        to add battery kWh capacity.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Booking Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Slot Duration</label>
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value={1}>1 hour</option>
                    <option value={2}>2 hours</option>
                    <option value={3}>3 hours</option>
                    <option value={4}>4 hours</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Instructions (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please leave the gate open"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Estimate Breakdown */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-2.5 border border-slate-100 text-sm">
                {hasBatteryCapacity && batteryCapacity && !batteryValidationMessage ? (
                  <>
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>Vehicle</span>
                      <span className="font-medium text-slate-800">
                        {selectedVehicle?.make} {selectedVehicle?.model} ({batteryCapacity} kWh)
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>Energy to be Delivered</span>
                      <span className="font-semibold text-slate-800">
                        {energyRequiredKwh} kWh ({currentBattery}% → {targetBattery}%)
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>Estimated Charging Time</span>
                      <span className="font-semibold text-emerald-700">
                        {formattedChargingTime} (at {charger.kwRating} kW)
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>Slot Reservation Duration</span>
                      <span className="font-medium text-slate-800">
                        {durationHours} {durationHours === 1 ? 'hour' : 'hours'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 leading-tight">
                      Slot reserved for {durationHours} hr{durationHours > 1 ? 's' : ''}. Estimated time to charge {currentBattery}% → {targetBattery}% is {formattedChargingTime}.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>Slot Reservation</span>
                      <span>{durationHours} hrs @ {charger.kwRating} kW</span>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                      {charger.pricePerKwh
                        ? `Energy billed at ${formatCurrency(charger.pricePerKwh)}/kWh upon completion.`
                        : `Billed at ${formatCurrency(charger.pricePerHour)}/hr.`}
                    </p>
                  </>
                )}

                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 text-base">
                  <span>Estimated Total</span>
                  <span className="text-emerald-600">{formatCurrency(estimatedCost)}</span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={bookingLoading || !!batteryValidationMessage}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 gap-2"
              >
                {bookingLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" /> Reserve & Confirm
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
