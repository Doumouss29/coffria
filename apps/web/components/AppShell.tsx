'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Bot, Building2, FileSignature, FileText, Folder, LayoutDashboard, LogOut, Megaphone, Settings, ShieldCheck, Trash2, Users, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const tenantLinks = [
  { href: '/explorer', label: 'Mes dossiers', icon: Folder },
  { href: '/assistant', label: 'Assistant IA', icon: Bot },
  { href: '/signatures', label: 'Espace signature', icon: FileSignature },
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
    if (!raw) return;
    const current = JSON.parse(raw);
    setUser(current);
    if (current.role !== 'SUPER_ADMIN' && current.tenantId) {
      api('/signature-subscription').then((subscription) => {
        const refreshed = {
          ...current,
          signatureEnabled: Boolean(subscription.signatureEnabled),
          signatureUsageLimit: subscription.signatureUsageLimit ?? null,
          signatureUsageUsed: Number(subscription.signatureUsageUsed || 0),
        };
        setUser(refreshed);
        localStorage.setItem('coffria_user', JSON.stringify(refreshed));
      }).catch(() => undefined);
    }
  }, [router]);

  useEffect(() => {
    if (user?.signatureEnabled !== false) return;
    const hideDisabledSignatureActions = () => {
      document.querySelectorAll('button').forEach((button) => {
        if ((button.textContent || '').includes('Demander des signatures')) button.style.display = 'none';
      });
    };
    hideDisabledSignatureActions();
    const observer = new MutationObserver(hideDisabledSignatureActions);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [user?.signatureEnabled]);

  const links = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN') {
      return [
        { href: '/admin/tenants', label: 'Entreprises clientes', icon: Building2 },
        { href: '/admin/statistiques', label: 'Statistiques du site', icon: BarChart3 },
        { href: '/admin/marketing', label: 'Vitrine & Marketing', icon: Megaphone },
        { href: '/admin/conditions', label: 'Conditions de vente', icon: FileText },
        { href: '/admin/superadmins', label: 'Super Admins', icon: ShieldCheck },
        { href: '/settings', label: 'Mon compte', icon: Settings },
      ];
    }
    const visible = user?.signatureEnabled === false ? tenantLinks.filter((link) => link.href !== '/signatures') : tenantLinks;
    if (user?.role === 'TENANT_ADMIN') return visible;
    if (user?.role === 'EDITOR') return visible.filter((link) => !['/users'].includes(link.href));
    return visible.filter((link) => !['/users','/groups','/signatures'].includes(link.href));
  }, [user]);

  const quotaReached = user?.signatureEnabled !== false && user?.signatureUsageLimit != null && Number(user.signatureUsageUsed || 0) >= Number(user.signatureUsageLimit);

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
        <header className="top"><strong>{title}</strong><span className="muted">{user?.name || 'Utilisateur Coffria'}</span><button type="button" className="mobileLogout" onClick={logout} aria-label="Se déconnecter" title="Déconnexion"><LogOut size={18}/></button></header>
        {quotaReached && pathname.startsWith('/signatures') && <div className="alert error subscriptionAlert">Quota de signatures atteint : {user.signatureUsageUsed} / {user.signatureUsageLimit}. Contactez votre administrateur pour augmenter ou réinitialiser le quota.</div>}
        {children}
      </main>
    </div>
  );
}
