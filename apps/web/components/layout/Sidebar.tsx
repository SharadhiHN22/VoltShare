'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Battery,
  PlusCircle,
  DollarSign,
  CalendarCheck,
  Menu,
  X,
  MapPin,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface SidebarLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarProps {
  links: SidebarLink[];
}

export const hostLinks: SidebarLink[] = [
  { label: 'Dashboard', href: '/host/dashboard', icon: LayoutDashboard },
  { label: 'My Chargers', href: '/host/chargers', icon: Battery },
  { label: 'Add Charger', href: '/host/chargers/new', icon: PlusCircle },
  { label: 'Earnings', href: '/host/earnings', icon: DollarSign },
  { label: 'Bookings', href: '/host/bookings', icon: CalendarCheck },
];

export const seekerLinks: SidebarLink[] = [
  { label: 'Find Chargers', href: '/map', icon: MapPin },
  { label: 'My Bookings', href: '/bookings', icon: ClipboardList },
];

export default function Sidebar({ links }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-brand-600 p-3 text-white shadow-lg lg:hidden"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 transform border-r border-gray-200 bg-white pt-16 transition-transform lg:static lg:translate-x-0 lg:pt-0',
          collapsed ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <nav className="flex flex-col gap-1 p-4">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setCollapsed(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <link.icon className={cn('h-5 w-5', active ? 'text-brand-600' : 'text-gray-400')} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
