'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, Folder, LayoutDashboard, LogOut, Settings, ShieldCheck, Trash2, Users, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const tenantLinks = [
  { href: '/explorer', label: 'Mes dossiers', icon: Folder },
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/users', label: 'Utilisateurs', icon: Users },
  { href: '/groups', label: 'Groupes d’accès', icon: UsersRound },
  { href: '/groups', label: 'Groupes d’accès', icon: UsersRound },
  { href: '/trash', label: 'Corbeille', icon: Trash2 },
  { href: '/settings', label: 'Paramètres', icon: Settings },
];

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('coffria_token');
    if (!token) {
      router.replace('/');
      return;
    }
    const raw = localStorage.getItem('coffria_user');
    if (raw) setUser(JSON.parse(raw));
  }, [router]);

  const links = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN') {
      return [
        { href: '/admin/tenants', label: 'Entreprises clientes', icon: Building2 },
        { href: '/admin/superadmins', label: 'Super Admins', icon: ShieldCheck },
        { href: '/settings', label: 'Mon compte', icon: Settings },
      ];
    }
    if (user?.role === 'TENANT_ADMIN') return tenantLinks;
    if (user?.role === 'EDITOR') return tenantLinks.filter((link) => link.href !== '/users');
    return tenantLinks.filter((link) => !['/users','/groups'].includes(link.href));
  }, [user]);

  function logout() {
    localStorage.removeItem('coffria_token');
    localStorage.removeItem('coffria_user');
    router.replace('/');
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Coffr<span>i</span>a</div>
        <div className="seller">Une solution LMurbs</div>
        <nav className="nav">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={pathname === href ? 'active' : ''}>
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <button className="logout" onClick={logout}><LogOut size={17} /> Déconnexion</button>
      </aside>
      <main className="main">
        <header className="top">
          <strong>{title}</strong>
          <span className="muted">{user?.name || 'Utilisateur Coffria'}</span>
        </header>
        {children}
      </main>
    </div>
  );
}
