'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Zap, Car, Calendar, PlusCircle, LogOut, LayoutDashboard, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import NotificationBell from '@/components/notifications/NotificationBell';
import { getStoredAuth, clearStoredAuth, AUTH_CHANGE_EVENT } from '@/lib/auth';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [userRole, setUserRole] = useState<'SEEKER' | 'HOST' | 'ADMIN' | null>(null);

  const syncAuth = useCallback(() => {
    const { token, role } = getStoredAuth();
    setIsAuth(!!token);
    setUserRole(token ? role : null);
  }, []);

  useEffect(() => {
    // Synchronize auth state on mount and route changes
    syncAuth();

    // Listen to local and cross-tab auth state changes
    const handleAuthChange = () => syncAuth();
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [pathname, syncAuth]);

  const handleLogout = () => {
    clearStoredAuth();
    setIsAuth(false);
    setUserRole(null);
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-gray-800 bg-gray-900 shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-white">
          <Zap className="h-6 w-6 text-brand-400" />
          <span className="text-xl font-bold">VoltShare</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {isAuth ? (
            userRole === 'HOST' ? (
              // HOST Nav Items
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-gray-300 transition-colors hover:text-white flex items-center gap-1.5"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  Charger List
                </Link>
                <Link
                  href="/bookings"
                  className="text-sm font-medium text-gray-300 transition-colors hover:text-white flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  Incoming Bookings
                </Link>
              </>
            ) : (
              // SEEKER Nav Items
              <>
                <Link
                  href="/map"
                  className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
                >
                  Find Chargers
                </Link>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-gray-300 transition-colors hover:text-white flex items-center gap-1.5"
                >
                  <LayoutDashboard className="w-4 h-4 text-brand-400" />
                  Dashboard
                </Link>
                <Link
                  href="/bookings"
                  className="text-sm font-medium text-gray-300 transition-colors hover:text-white flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  My Bookings
                </Link>
                <Link
                  href="/profile/vehicles"
                  className="text-sm font-medium text-gray-300 transition-colors hover:text-white flex items-center gap-1.5"
                >
                  <Car className="w-4 h-4 text-emerald-400" />
                  My Vehicles
                </Link>
              </>
            )
          ) : (
            // Public / Unauthenticated Nav Items
            <>
              <Link
                href="/map"
                className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
              >
                Find Chargers
              </Link>
              <Link
                href="/#how-it-works"
                className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
              >
                How It Works
              </Link>
            </>
          )}
        </nav>

        {/* Desktop auth buttons */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuth ? (
            <div className="flex items-center gap-3">
              <NotificationBell />

              {/* Role-Specific Action Buttons */}
              {userRole === 'HOST' && (
                <>
                  <Link href="/dashboard">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-gray-700 bg-gray-800 text-gray-200 hover:text-white hover:bg-gray-700 gap-1.5 text-xs font-medium shadow-none"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Charger List
                    </Button>
                  </Link>
                  <Link href="/chargers/new">
                    <Button
                      variant="primary"
                      size="sm"
                      className="gap-1.5 text-xs font-medium"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Add Charger
                    </Button>
                  </Link>
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-400 hover:text-rose-400 hover:bg-gray-800 text-xs gap-1"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </Button>
            </div>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-gray-800">
                  Log In
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu and notifications */}
        <div className="flex items-center gap-2 md:hidden">
          {isAuth && <NotificationBell />}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-gray-300"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'overflow-hidden border-t border-gray-800 bg-gray-900 transition-all md:hidden',
          mobileOpen ? 'max-h-96' : 'max-h-0',
        )}
      >
        <div className="space-y-1 px-4 pb-4 pt-2">
          {isAuth ? (
            userRole === 'HOST' ? (
              // HOST Mobile Menu (No Seeker features / No My Vehicles)
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  Charger List / Dashboard
                </Link>
                <Link
                  href="/bookings"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  Incoming Bookings
                </Link>
                <Link
                  href="/chargers/new"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 text-brand-400" />
                  Add New Charger
                </Link>
                <Link
                  href="/notifications"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <Bell className="w-4 h-4 text-blue-400" />
                  Notifications
                </Link>
              </>
            ) : (
              // SEEKER Mobile Menu (No Host features / No Charger List / No Add Charger)
              <>
                <Link
                  href="/map"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-brand-400" />
                  Find Chargers
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4 text-brand-400" />
                  Driver Dashboard
                </Link>
                <Link
                  href="/bookings"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  My Bookings
                </Link>
                <Link
                  href="/profile/vehicles"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <Car className="w-4 h-4 text-emerald-400" />
                  My Vehicles
                </Link>
                <Link
                  href="/notifications"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <Bell className="w-4 h-4 text-blue-400" />
                  Notifications
                </Link>
              </>
            )
          ) : (
            // Public Mobile Menu
            <>
              <Link
                href="/map"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                Find Chargers
              </Link>
              <Link
                href="/#how-it-works"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                How It Works
              </Link>
            </>
          )}

          <div className="flex gap-2 pt-3">
            {isAuth ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="w-full border-gray-600 text-rose-300 hover:text-rose-200 hover:bg-gray-800"
              >
                Sign Out
              </Button>
            ) : (
              <>
                <Link href="/login" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full border-gray-600 text-gray-300">
                    Log In
                  </Button>
                </Link>
                <Link href="/register" className="flex-1">
                  <Button variant="primary" size="sm" className="w-full">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
