'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bot, Building2, FileSignature, Folder, LayoutDashboard, LogOut, Megaphone, Settings, ShieldCheck, Trash2, Users, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const tenantLinks = [
  { href: '/explorer', label: 'Mes dossiers', icon: Folder },
  { href: '/assistant', label: 'Assistant IA', icon: Bot },
  { href: '/signatures', label: 'Signatures', icon: FileSignature },
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/users', label: 'Utilisateurs', icon: Users },
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
    if (!token) { router.replace('/connexion'); return; }
    const raw = localStorage.getItem('coffria_user');
    if (raw) setUser(JSON.parse(raw));
  }, [router]);

  const links = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN') {
      return [
        { href: '/admin/tenants', label: 'Entreprises clientes', icon: Building2 },
        { href: '/admin/marketing', label: 'Vitrine & Marketing', icon: Megaphone },
        { href: '/admin/superadmins', label: 'Super Admins', icon: ShieldCheck },
        { href: '/settings', label: 'Mon compte', icon: Settings },
      ];
    }
    if (user?.role === 'TENANT_ADMIN') return tenantLinks;
    if (user?.role === 'EDITOR') return tenantLinks.filter((link) => !['/users'].includes(link.href));
    return tenantLinks.filter((link) => !['/users','/groups','/signatures'].includes(link.href));
  }, [user]);

  function logout() {
    localStorage.removeItem('coffria_token');
    localStorage.removeItem('coffria_user');
    router.replace('/connexion');
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Coffr<span>i</span>a</div>
        <div className="seller">Une solution LMurbs</div>
        <nav className="nav">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''}>
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <button className="logout" onClick={logout}><LogOut size={17} /> Déconnexion</button>
      </aside>
      <main className="main">
        <header className="top"><strong>{title}</strong><span className="muted">{user?.name || 'Utilisateur Coffria'}</span></header>
        {children}
      </main>
    </div>
  );
}
