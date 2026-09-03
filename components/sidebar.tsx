'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard, ClipboardList, Factory, FileText, ShieldCheck, Users, History, Menu, X, LogOut, KeyRound,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'AUDITOR'] },
  { href: '/audits', label: 'Audits', icon: ClipboardList, roles: ['ADMIN', 'AUDITOR'] },
  { href: '/factories', label: 'Factories', icon: Factory, roles: ['ADMIN', 'AUDITOR'] },
  { href: '/caps', label: 'CAPs', icon: ShieldCheck, roles: ['ADMIN', 'AUDITOR'] },
  { href: '/reports', label: 'Reports', icon: FileText, roles: ['ADMIN', 'AUDITOR'] },
  { href: '/admin/templates', label: 'Templates', icon: ClipboardList, roles: ['ADMIN'] },
  { href: '/admin/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { href: '/history', label: 'History', icon: History, roles: ['ADMIN', 'AUDITOR'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const role = session?.user?.role;

  const visibleNav = navItems.filter((item) => item.roles.includes(role || 'AUDITOR'));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-md bg-white p-2 shadow border sm:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-white transition-transform duration-200 ease-in-out sm:static sm:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-4">
            <Link href="/dashboard" className="text-lg font-bold text-[hsl(210,70%,28%)]">VCM SaaS</Link>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 sm:hidden" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>

          <Separator />

          <nav className="flex-1 space-y-1 p-3">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                    active ? 'bg-[hsl(210,70%,28%)] text-white' : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Separator />

          <div className="p-4 space-y-2">
            <div className="text-xs text-slate-500">
              <p className="font-medium text-slate-900 truncate">{session?.user?.name || session?.user?.email}</p>
              <p className="capitalize">{role?.toLowerCase()}</p>
            </div>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
              <Link href="/account/password">
                <KeyRound className="h-4 w-4" /> Change Password
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-slate-600" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
