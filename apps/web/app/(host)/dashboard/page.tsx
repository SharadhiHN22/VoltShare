'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Zap,
  TrendingUp,
  CalendarCheck,
  Star,
  PlusCircle,
  Eye,
  ArrowUpRight,
  Clock,
  CheckCircle,
  CheckCircle2,
  Power,
  Loader2,
  AlertCircle,
  MapPin,
  Car,
  Calendar,
  CreditCard,
  Bell,
  ArrowRight,
  ShieldCheck,
  BatteryCharging,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { chargerApi, bookingApi, paymentApi, vehicleApi, notificationApi } from '@/lib/api';
import { getStoredAuth } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CHARGER_TYPE_LABELS, CONNECTOR_TYPE_LABELS } from '@voltshare/shared';

// =====================================================================
// HOST DASHBOARD COMPONENT
// =====================================================================
function HostDashboard() {
  const [chargers, setChargers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [chargersRes, bookingsRes, earningsRes] = await Promise.allSettled([
        chargerApi.listMine(),
        bookingApi.list(),
        paymentApi.earnings(),
      ]);

      if (chargersRes.status === 'fulfilled' && chargersRes.value?.data) {
        setChargers(chargersRes.value.data);
      }
      if (bookingsRes.status === 'fulfilled' && bookingsRes.value?.data) {
        setBookings(bookingsRes.value.data);
      }
      if (earningsRes.status === 'fulfilled' && earningsRes.value?.data) {
        setEarnings(earningsRes.value.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load host dashboard details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleToggleStatus = async (chargerId: string) => {
    setTogglingId(chargerId);
    try {
      await chargerApi.toggleStatus(chargerId);
      const res = await chargerApi.listMine();
      setChargers(res.data || []);
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle charger status');
    } finally {
      setTogglingId(null);
    }
  };

  const activeChargersCount = chargers.filter((c) => c.status === 'ACTIVE').length;
  const chargersWithReviews = chargers.filter((c) => Number(c.totalReviews || 0) > 0);
  const totalHostReviews = chargers.reduce((acc, c) => acc + Number(c.totalReviews || 0), 0);
  const averageRatingDisplay =
    chargersWithReviews.length > 0
      ? (
          chargersWithReviews.reduce((acc, c) => acc + Number(c.avgRating || 0), 0) /
          chargersWithReviews.length
        ).toFixed(1)
      : chargers.length > 0
      ? '5.0'
      : '0.0';

  const totalEarningsDisplay =
    earnings?.totalEarnings !== undefined ? formatCurrency(earnings.totalEarnings) : '₹ 0';
  const thisMonthEarningsDisplay =
    earnings?.thisMonthEarnings !== undefined ? formatCurrency(earnings.thisMonthEarnings) : '₹ 0';

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-1.5">
            <Zap className="w-3.5 h-3.5" /> Host Mode
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Host Dashboard</h1>
          <p className="text-sm text-slate-500">
            Monitor charger operations, revenue, and incoming reservations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/chargers/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm">
              <PlusCircle className="w-4 h-4" /> Add New Charger
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
            <span>Total Earnings</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{totalEarningsDisplay}</div>
          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> This Month: {thisMonthEarningsDisplay}
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
            <span>Active Ports</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Zap className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {activeChargersCount} / {chargers.length}
          </div>
          <div className="text-xs text-slate-500">Online and visible on map</div>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
            <span>Total Bookings</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <CalendarCheck className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{bookings.length}</div>
          <div className="text-xs text-slate-500">Across all registered chargers</div>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
            <span>Average Rating</span>
            <span className="p-2 bg-amber-50 text-amber-500 rounded-xl">
              <Star className="w-5 h-5 fill-amber-500" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{averageRatingDisplay}</div>
          <div className="text-xs text-slate-500">
            {totalHostReviews > 0 ? `${totalHostReviews} verified reviews` : 'Host service rating'}
          </div>
        </div>
      </div>

      {/* Host Chargers Management Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">My Registered Chargers</h2>
            <p className="text-xs text-slate-500">Control charger power status and view details</p>
          </div>
          <Link href="/chargers/new">
            <Button variant="outline" className="text-xs gap-1.5">
              <PlusCircle className="w-3.5 h-3.5" /> Register Charger
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading chargers...</span>
          </div>
        ) : chargers.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No chargers listed yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Start earning by sharing your home or commercial EV charger with nearby electric vehicle owners.
            </p>
            <Link href="/chargers/new">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs mt-2">
                List Your First Charger
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {chargers.map((c) => (
              <div
                key={c.id}
                className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        c.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {c.status}
                    </span>
                    <Badge variant="neutral">{CHARGER_TYPE_LABELS[c.chargerType] || c.chargerType}</Badge>
                    <Badge variant="info">{c.kwRating} kW</Badge>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{c.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.address}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <button
                    onClick={() => handleToggleStatus(c.id)}
                    disabled={togglingId === c.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      c.status === 'ACTIVE'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {togglingId === c.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                    <span>{c.status === 'ACTIVE' ? 'Set Offline' : 'Set Active'}</span>
                  </button>

                  <Link href={`/chargers/${c.id}`}>
                    <Button variant="outline" className="text-xs px-3 py-1.5 gap-1">
                      <Eye className="w-3.5 h-3.5" /> View Listing
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Reservations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Customer Bookings</h2>
            <p className="text-xs text-slate-500">Review scheduled driver reservations and payouts</p>
          </div>
          <Link href="/bookings" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
            View All
          </Link>
        </div>

        {bookings.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No incoming bookings yet. Your chargers are listed and ready for EV drivers to book!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-6">Driver</th>
                  <th className="py-3.5 px-6">Charger</th>
                  <th className="py-3.5 px-6">Scheduled Time</th>
                  <th className="py-3.5 px-6">Amount</th>
                  <th className="py-3.5 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">
                      {b.seeker?.name || 'EV Driver'}
                    </td>
                    <td className="py-4 px-6 text-xs">{b.charger?.title || 'Charger'}</td>
                    <td className="py-4 px-6 text-xs">
                      {formatDate(b.startTime)} at{' '}
                      {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900">
                      {formatCurrency(b.totalAmount)}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : b.status === 'CONFIRMED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : b.status === 'ACTIVE'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// SEEKER (DRIVER) DASHBOARD COMPONENT
// =====================================================================
function SeekerDashboard() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [nearbyChargers, setNearbyChargers] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeekerData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [bookingsRes, vehiclesRes, chargersRes, notifRes] = await Promise.allSettled([
          bookingApi.list(),
          vehicleApi.list(),
          chargerApi.search({ latitude: 12.9716, longitude: 77.5946, limit: 4 }),
          notificationApi.unreadCount(),
        ]);

        if (bookingsRes.status === 'fulfilled' && bookingsRes.value?.data) {
          setBookings(bookingsRes.value.data);
        }
        if (vehiclesRes.status === 'fulfilled' && vehiclesRes.value?.data) {
          setVehicles(vehiclesRes.value.data);
        }
        if (chargersRes.status === 'fulfilled' && chargersRes.value?.data) {
          setNearbyChargers(chargersRes.value.data);
        }
        if (notifRes.status === 'fulfilled' && notifRes.value?.data) {
          setUnreadNotifications(notifRes.value.data.unreadCount || 0);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load driver dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchSeekerData();
  }, []);

  const activeBookings = bookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'PENDING' || b.status === 'ACTIVE',
  );
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const upcomingBooking = activeBookings.length > 0 ? activeBookings[0] : null;
  const primaryVehicle = vehicles.length > 0 ? vehicles[0] : null;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1.5">
            <Car className="w-3.5 h-3.5" /> EV Driver Mode
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Driver Dashboard</h1>
          <p className="text-sm text-slate-500">
            Track your charging sessions, reservations, and saved vehicles
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <Link href="/map">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm text-xs sm:text-sm">
              <Zap className="w-4 h-4" /> Find Chargers
            </Button>
          </Link>
          <Link href="/profile/vehicles">
            <Button variant="outline" className="gap-2 text-xs sm:text-sm">
              <Car className="w-4 h-4 text-emerald-600" /> My Vehicles
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/bookings" className="group">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2 group-hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
              <span>Active Bookings</span>
              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <CalendarCheck className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{activeBookings.length}</div>
            <div className="text-xs text-slate-500">Scheduled or in progress</div>
          </div>
        </Link>

        <Link href="/profile/vehicles" className="group">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2 group-hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
              <span>Saved Vehicles</span>
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Car className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{vehicles.length}</div>
            <div className="text-xs text-slate-500">Configured EV profiles</div>
          </div>
        </Link>

        <Link href="/bookings" className="group">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2 group-hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
              <span>Completed Sessions</span>
              <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{completedBookings.length}</div>
            <div className="text-xs text-slate-500">Successful charging sessions</div>
          </div>
        </Link>

        <Link href="/notifications" className="group">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2 group-hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
              <span>Notifications</span>
              <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Bell className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{unreadNotifications}</div>
            <div className="text-xs text-slate-500">Unread booking & payment alerts</div>
          </div>
        </Link>
      </div>

      {/* Main Grid: Active Reservation & Vehicle Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Active Reservation & Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active / Upcoming Reservation Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">Next Scheduled Charging</h2>
              </div>
              {upcomingBooking && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    upcomingBooking.status === 'CONFIRMED'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : upcomingBooking.status === 'ACTIVE'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {upcomingBooking.status}
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-8 flex items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-xs">Loading reservation...</span>
              </div>
            ) : upcomingBooking ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {upcomingBooking.charger?.title || 'Charging Station'}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{upcomingBooking.charger?.address || 'Bangalore, Karnataka'}</span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-lg font-black text-slate-900">
                      {formatCurrency(upcomingBooking.totalAmount)}
                    </div>
                    <span className="text-xs text-slate-500">
                      {upcomingBooking.charger?.kwRating} kW Port
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Date</span>
                    <span className="font-semibold text-slate-800">{formatDate(upcomingBooking.startTime)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Slot Time</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(upcomingBooking.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Connector</span>
                    <span className="font-semibold text-slate-800">
                      {CONNECTOR_TYPE_LABELS[upcomingBooking.charger?.connectorType] ||
                        upcomingBooking.charger?.connectorType ||
                        'Type 2'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Link href="/bookings">
                    <Button variant="outline" className="text-xs gap-1.5">
                      <CalendarCheck className="w-4 h-4" /> View in My Bookings
                    </Button>
                  </Link>

                  {upcomingBooking.status === 'PENDING' ? (
                    <Link href="/bookings">
                      <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm">
                        <CreditCard className="w-4 h-4" /> Pay Now to Confirm
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/map">
                      <Button className="bg-slate-900 hover:bg-slate-800 text-white text-xs gap-1.5">
                        <MapPin className="w-4 h-4" /> View Station on Map
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">No active bookings</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Ready for your next trip? Locate available charging stations across Bangalore and reserve a slot.
                  </p>
                </div>
                <Link href="/map">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs mt-1 gap-1.5">
                    <MapPin className="w-4 h-4" /> Search Chargers on Map
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Recent Charging Sessions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recent Charging Activity</h2>
                <p className="text-xs text-slate-500">Your recent station visits and completed sessions</p>
              </div>
              <Link href="/bookings" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                All Bookings →
              </Link>
            </div>

            {loading ? (
              <div className="py-8 flex items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-xs">Loading activity...</span>
              </div>
            ) : bookings.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 space-y-1">
                <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No charging activity yet</p>
                <p>When you book and use charging stations, your history will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bookings.slice(0, 5).map((b) => (
                  <div key={b.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {b.charger?.title || 'Charging Station'}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            b.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : b.status === 'CONFIRMED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{formatDate(b.startTime)}</span>
                        <span>•</span>
                        <span>{formatCurrency(b.totalAmount)}</span>
                      </div>
                    </div>

                    <Link href={`/chargers/${b.chargerId || b.charger?.id}`}>
                      <Button variant="outline" className="text-xs px-2.5 py-1 gap-1">
                        Book Again <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Saved Vehicle & Nearby Stations */}
        <div className="space-y-6">
          {/* Saved Vehicle Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Primary Vehicle</h3>
              </div>
              <Link
                href="/profile/vehicles"
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                Manage
              </Link>
            </div>

            {loading ? (
              <div className="py-6 flex items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-xs">Loading vehicle...</span>
              </div>
            ) : primaryVehicle ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      {primaryVehicle.make} {primaryVehicle.model}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{primaryVehicle.year}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant="info">
                      {CONNECTOR_TYPE_LABELS[primaryVehicle.connectorType] || primaryVehicle.connectorType}
                    </Badge>
                    {primaryVehicle.batteryCapacity && (
                      <Badge variant="success">
                        <BatteryCharging className="w-3 h-3 mr-1" />
                        {primaryVehicle.batteryCapacity} kWh
                      </Badge>
                    )}
                  </div>

                  {primaryVehicle.registrationNumber && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      Plate: {primaryVehicle.registrationNumber}
                    </div>
                  )}
                </div>

                <Link href="/profile/vehicles">
                  <Button variant="outline" className="w-full text-xs gap-1.5">
                    <Car className="w-3.5 h-3.5 text-emerald-600" /> Manage All Saved Vehicles ({vehicles.length})
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <Car className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">No vehicle saved in your driver profile</p>
                <Link href="/profile/vehicles">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1">
                    <PlusCircle className="w-3.5 h-3.5" /> Add Your EV
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Recommended Nearby Stations */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-base">Nearby Chargers</h3>
              </div>
              <Link href="/map" className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold">
                Map View
              </Link>
            </div>

            {nearbyChargers.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                Open the map to find active charging stations.
              </div>
            ) : (
              <div className="space-y-3">
                {nearbyChargers.slice(0, 3).map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/chargers/${ch.id}`}
                    className="block p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-slate-50/80 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[180px]">
                        {ch.title}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700">
                        {ch.pricePerKwh ? `${formatCurrency(ch.pricePerKwh)}/kWh` : `${formatCurrency(ch.pricePerHour)}/hr`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="truncate max-w-[160px]">{ch.address}</span>
                      <span className="font-semibold text-slate-700">{ch.kwRating} kW</span>
                    </div>
                  </Link>
                ))}

                <Link href="/map" className="block text-center pt-1">
                  <span className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1">
                    Explore All Available Stations <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// ROOT DASHBOARD PAGE (ROLE DISPATCHER)
// =====================================================================
export default function DashboardPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'SEEKER' | 'HOST' | 'ADMIN' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { token, role } = getStoredAuth();

    if (!token) {
      router.push('/login?redirect=/dashboard');
      return;
    }

    if (role) {
      setUserRole(role);
    }

    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-sm text-slate-500 font-medium">Loading your dashboard...</span>
      </div>
    );
  }

  // Render Host Dashboard for HOST role; render Seeker Dashboard for SEEKER role (and default)
  if (userRole === 'HOST') {
    return <HostDashboard />;
  }

  return <SeekerDashboard />;
}
