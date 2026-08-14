'use client';

import { BarChart3, CalendarDays, Globe2, MousePointerClick, RefreshCw, Users, Eye } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

type Preset = 'day' | 'week' | 'month' | 'year' | 'custom';

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function presetRange(preset: Preset) {
  const to = new Date();
  const from = new Date(to);
  if (preset === 'day') from.setDate(to.getDate());
  if (preset === 'week') from.setDate(to.getDate() - 6);
  if (preset === 'month') from.setMonth(to.getMonth() - 1);
  if (preset === 'year') from.setFullYear(to.getFullYear() - 1);
  return { from: isoDate(from), to: isoDate(to) };
}
function n(value: any) { return Number(value || 0).toLocaleString('fr-FR'); }
function shortDate(value: string, bucket: string) {
  const d = new Date(value);
  if (bucket === 'hour') return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
  if (bucket === 'month') return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(d);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(d);
}

export default function StatisticsPage() {
  const [preset, setPreset] = useState<Preset>('week');
  const initial = useMemo(() => presetRange('week'), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextFrom = from, nextTo = to) {
    setLoading(true); setError('');
    try { setData(await api(`/analytics/summary?from=${encodeURIComponent(nextFrom)}&to=${encodeURIComponent(nextTo)}`)); }
    catch (e: any) { setError(e.message || 'Impossible de charger les statistiques.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(initial.from, initial.to); }, []);

  function choose(next: Exclude<Preset, 'custom'>) {
    const range = presetRange(next);
    setPreset(next); setFrom(range.from); setTo(range.to); load(range.from, range.to);
  }

  const maxSeries = Math.max(1, ...(data?.series || []).map((item: any) => Number(item.views || 0)));
  const maxPage = Math.max(1, ...(data?.pages || []).map((item: any) => Number(item.views || 0)));
  const maxClick = Math.max(1, ...(data?.clicks || []).map((item: any) => Number(item.clicks || 0)));

  return <AppShell title="Statistiques du site">
    <section className="content" style={{display:'grid',gap:22}}>
      <div className="pageTitle" style={{alignItems:'flex-start'}}>
        <div><h1>Statistiques de fréquentation</h1><p className="muted">Suivez la vie du site public Coffria : visites, pages consultées, clics et provenance géographique.</p></div>
        <button className="secondary" onClick={()=>load()} disabled={loading}><RefreshCw size={16}/> Actualiser</button>
      </div>

      <div className="card" style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {([['day','Jour'],['week','Semaine'],['month','Mois'],['year','Année']] as const).map(([key,label])=><button key={key} className={preset===key?'primary':'secondary'} onClick={()=>choose(key)}>{label}</button>)}
        </div>
        <label className="field" style={{minWidth:160,marginLeft:'auto'}}>Du<input type="date" value={from} onChange={(e)=>{setFrom(e.target.value);setPreset('custom')}}/></label>
        <label className="field" style={{minWidth:160}}>Au<input type="date" value={to} onChange={(e)=>{setTo(e.target.value);setPreset('custom')}}/></label>
        <button className="primary" onClick={()=>load()}><CalendarDays size={16}/> Appliquer</button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && !data && <div className="card">Chargement des statistiques…</div>}

      {data && <>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14}}>
          <article className="card"><div className="muted" style={{display:'flex',gap:8,alignItems:'center'}}><Eye size={18}/> Pages vues</div><strong style={{fontSize:34,display:'block',marginTop:8}}>{n(data.totals?.pageViews)}</strong></article>
          <article className="card"><div className="muted" style={{display:'flex',gap:8,alignItems:'center'}}><Users size={18}/> Visiteurs uniques</div><strong style={{fontSize:34,display:'block',marginTop:8}}>{n(data.totals?.uniqueVisitors)}</strong></article>
          <article className="card"><div className="muted" style={{display:'flex',gap:8,alignItems:'center'}}><BarChart3 size={18}/> Sessions</div><strong style={{fontSize:34,display:'block',marginTop:8}}>{n(data.totals?.sessions)}</strong></article>
          <article className="card"><div className="muted" style={{display:'flex',gap:8,alignItems:'center'}}><MousePointerClick size={18}/> Clics suivis</div><strong style={{fontSize:34,display:'block',marginTop:8}}>{n(data.totals?.clicks)}</strong></article>
        </div>

        <article className="card">
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:18}}><div><h2 style={{margin:0}}>Évolution des visites</h2><p className="muted" style={{margin:'5px 0 0'}}>Nombre de pages vues sur la période sélectionnée.</p></div></div>
          {(data.series || []).length === 0 ? <p className="muted">Aucune visite enregistrée sur cette période.</p> : <div style={{height:230,display:'flex',alignItems:'end',gap:6,overflowX:'auto',paddingTop:10}}>
            {(data.series || []).map((item:any,index:number)=><div key={index} title={`${shortDate(item.bucket,data.range.bucket)} : ${item.views} vues`} style={{height:'100%',minWidth:data.series.length>60?7:20,flex:data.series.length<=30?'1 1 0':'0 0 auto',display:'flex',flexDirection:'column',justifyContent:'end',alignItems:'center',gap:6}}><div style={{width:'100%',maxWidth:36,minHeight:3,height:`${Math.max(3,(Number(item.views||0)/maxSeries)*180)}px`,background:'#c97a3d',borderRadius:'5px 5px 2px 2px'}}/><small className="muted" style={{fontSize:10,whiteSpace:'nowrap',transform:data.series.length>30?'rotate(-45deg)':'none',transformOrigin:'center'}}>{data.series.length>60?'':shortDate(item.bucket,data.range.bucket)}</small></div>)}
          </div>}
        </article>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:18}}>
          <article className="card"><h2 style={{marginTop:0}}>Pages les plus consultées</h2><div style={{display:'grid',gap:12}}>{(data.pages||[]).map((item:any)=><div key={item.path}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong style={{overflow:'hidden',textOverflow:'ellipsis'}}>{item.path}</strong><span>{n(item.views)} vues</span></div><div style={{height:7,background:'#eef1f5',borderRadius:999,marginTop:6,overflow:'hidden'}}><div style={{height:'100%',width:`${(Number(item.views||0)/maxPage)*100}%`,background:'#14213d'}}/></div><small className="muted">{n(item.visitors)} visiteurs uniques</small></div>)}</div></article>
          <article className="card"><h2 style={{marginTop:0}}>Éléments les plus cliqués</h2><div style={{display:'grid',gap:12}}>{(data.clicks||[]).map((item:any,index:number)=><div key={`${item.label}-${index}`}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong style={{overflow:'hidden',textOverflow:'ellipsis'}}>{item.label || item.target || item.path}</strong><span>{n(item.clicks)}</span></div><div style={{height:7,background:'#eef1f5',borderRadius:999,marginTop:6,overflow:'hidden'}}><div style={{height:'100%',width:`${(Number(item.clicks||0)/maxClick)*100}%`,background:'#c97a3d'}}/></div><small className="muted">Depuis {item.path}{item.target?` → ${item.target}`:''}</small></div>)}</div></article>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:18}}>
          <article className="card"><div style={{display:'flex',gap:8,alignItems:'center'}}><Globe2 size={20}/><h2 style={{margin:0}}>Pays des visiteurs</h2></div><table className="table" style={{marginTop:16}}><thead><tr><th>Pays</th><th>Visiteurs</th><th>Part</th></tr></thead><tbody>{(data.geography?.countries||[]).map((item:any)=>{const total=Math.max(1,Number(data.totals?.uniqueVisitors||0));return <tr key={`${item.country}-${item.countryCode}`}><td>{item.country}</td><td>{n(item.visitors)}</td><td>{Math.round(Number(item.visitors||0)*100/total)} %</td></tr>})}</tbody></table></article>
          <article className="card"><h2 style={{marginTop:0}}>Villes principales</h2><table className="table"><thead><tr><th>Ville</th><th>Pays</th><th>Visiteurs</th></tr></thead><tbody>{(data.geography?.cities||[]).map((item:any,index:number)=><tr key={`${item.city}-${item.country}-${index}`}><td>{item.city}</td><td>{item.country}</td><td>{n(item.visitors)}</td></tr>)}</tbody></table></article>
        </div>

        <div className="muted" style={{fontSize:12}}>Les statistiques démarrent à partir du déploiement de ce module. La localisation est approximative et dérivée de l’adresse IP ; l’adresse IP brute n’est pas conservée dans Coffria.</div>
      </>}
    </section>
  </AppShell>;
}
