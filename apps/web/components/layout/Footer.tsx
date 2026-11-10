import React from 'react';
import Link from 'next/link';
import { Zap, Twitter, Github, Linkedin } from 'lucide-react';

const footerSections = [
  {
    title: 'For Drivers',
    links: [
      { label: 'Find a Charger', href: '/map' },
      { label: 'My Bookings', href: '/bookings' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'EV Guide', href: '/#' },
    ],
  },
  {
    title: 'For Hosts',
    links: [
      { label: 'List Your Charger', href: '/host/chargers/new' },
      { label: 'Host Dashboard', href: '/host/dashboard' },
      { label: 'Earnings', href: '/host/earnings' },
      { label: 'Host FAQ', href: '/#' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/#' },
      { label: 'Contact Us', href: '/#' },
      { label: 'Privacy Policy', href: '/#' },
      { label: 'Terms of Service', href: '/#' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* About */}
          <div>
            <Link href="/" className="flex items-center gap-2 text-gray-900">
              <Zap className="h-5 w-5 text-brand-600" />
              <span className="text-lg font-bold">VoltShare</span>
            </Link>
            <p className="mt-3 text-sm text-gray-500">
              India&apos;s peer-to-peer EV charging marketplace. Find chargers
              near you or earn by sharing yours.
            </p>
            <div className="mt-4 flex gap-3">
              <a href="#" className="text-gray-400 hover:text-gray-600" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-600" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-600" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Link sections */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-gray-900">
                {section.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-brand-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div className="mt-10 border-t border-gray-200 pt-6">
          <p className="text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} VoltShare. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
