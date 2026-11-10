'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, MapPin, Calendar, CreditCard, ShieldCheck, ArrowRight, BatteryCharging, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import { statsApi, PlatformStats } from '@/lib/api';

export default function HomePage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    statsApi
      .getPublicStats()
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setStats(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load platform stats:', err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 text-white py-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Zap className="w-3.5 h-3.5" /> Next-Gen EV Charging Network
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
            Find EV Charging, <span className="text-emerald-400">Anywhere You Go</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-slate-300">
            Connect directly with verified private charger hosts and public stations. Book guaranteed slots, avoid range anxiety, and pay seamlessly.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link href="/map">
              <Button size="lg" className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
                <MapPin className="w-5 h-5" /> Find a Charger
              </Button>
            </Link>
            <Link href="/register?role=HOST">
              <Button size="lg" variant="outline" className="gap-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-semibold">
                List Your Charger <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">How VoltShare Works</h2>
            <p className="text-slate-600 max-w-xl mx-auto">Three simple steps to charge your electric vehicle without the wait or range worries.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl">
                <MapPin className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">1. Locate Nearby</h3>
              <p className="text-slate-600 text-sm">
                Search interactive live maps for private home chargers, commercial hubs, and fast charging points nearby.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">2. Reserve Your Slot</h3>
              <p className="text-slate-600 text-sm">
                Select your time slot and duration in advance so you arrive with zero waiting queue and guaranteed availability.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl">
                <CreditCard className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">3. Plug & Pay</h3>
              <p className="text-slate-600 text-sm">
                Scan QR code on arrival, power up your EV, and settle securely via Razorpay or automated wallet billing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For Hosts Banner */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-emerald-400 font-semibold text-sm tracking-wide uppercase">Monetize Your Idle Charger</span>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              Turn your driveway into an earning station with VoltShare
            </h2>
            <p className="text-slate-300">
              Thousands of EV owners need reliable charging spots. Register your home, business, or private parking charger, set your hours and pricing, and start earning passive income.
            </p>
            <ul className="space-y-3">
              {[
                'Flexible scheduling — choose exactly when your charger is available',
                'Custom pricing per kWh or per hour',
                'Verified drivers with secure in-app payments',
                'Transparent dashboard tracking earnings and payouts',
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-slate-200 text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <Link href="/register?role=HOST">
                <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  Become a Host Today
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-slate-800 rounded-2xl border border-slate-700/60 text-center space-y-2">
              <Users className="w-8 h-8 mx-auto text-emerald-400" />
              <div className="text-3xl font-bold">
                {stats ? stats.registeredDrivers.toLocaleString() : (loading ? '...' : '0')}
              </div>
              <div className="text-xs text-slate-400">Registered EV Drivers</div>
            </div>
            <div className="p-6 bg-slate-800 rounded-2xl border border-slate-700/60 text-center space-y-2">
              <BatteryCharging className="w-8 h-8 mx-auto text-emerald-400" />
              <div className="text-3xl font-bold">
                {stats ? stats.activeChargers.toLocaleString() : (loading ? '...' : '0')}
              </div>
              <div className="text-xs text-slate-400">Active Charging Ports</div>
            </div>
            <div className="p-6 bg-slate-800 rounded-2xl border border-slate-700/60 text-center space-y-2">
              <Zap className="w-8 h-8 mx-auto text-emerald-400" />
              <div className="text-3xl font-bold">
                {stats ? stats.completedSessions.toLocaleString() : (loading ? '...' : '0')}
              </div>
              <div className="text-xs text-slate-400">Completed Charging Sessions</div>
            </div>
            <div className="p-6 bg-slate-800 rounded-2xl border border-slate-700/60 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 mx-auto text-emerald-400" />
              <div className="text-3xl font-bold">
                {stats ? stats.reviewsCount.toLocaleString() : (loading ? '...' : '0')}
              </div>
              <div className="text-xs text-slate-400">Customer Reviews</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
