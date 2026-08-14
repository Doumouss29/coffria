'use client';

import { BarChart3, CalendarDays, Clock3, Eye, Globe2, MapPin, MousePointerClick, RefreshCw, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

type Preset = 'day' | 'week' | 'month' | 'year' | 'custom';
function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function presetRange(preset: Preset) {
  const to = new Date(); const from = new Date(to);
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
  const [from, setFrom] = useState(initial.from); const [to, setTo] = useState(initial.to);
  const [country, setCountry] = useState(''); const [region, setRegion] = useState(''); const [city, setCity] = useState('');
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');

  async function load(nextFrom = from, nextTo = to, nextCountry = country, nextRegion = region, nextCity = city) {
    setLoading(true); setError('');
    const params = new URLSearchParams({ from: nextFrom, to: nextTo });
    if (nextCountry) params.set('country', nextCountry); if (nextRegion) params.set('region', nextRegion); if (nextCity) params.set('city', nextCity);
    try { setData(await api(`/analytics/summary?${params.toString()}`)); }
    catch (e: any) { setError(e.message || 'Impossible de charger les statistiques.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(initial.from, initial.to, '', '', ''); }, []);
  function choose(next: Exclude<Preset, 'custom'>) { const range = presetRange(next); setPreset(next); setFrom(range.from); setTo(range.to); load(range.from, range.to); }

  const options = data?.locationOptions || [];
  const countries = Array.from(new Set(options.map((x:any)=>x.country).filter(Boolean))) as string[];
  const regions = Array.from(new Set(options.filter((x:any)=>!country || x.country===country).map((x:any)=>x.region).filter(Boolean))) as string[];
  const cities = Array.from(new Set(options.filter((x:any)=>(!country || x.country===country)&&(!region || x.region===region)).map((x:any)=>x.city).filter(Boolean))) as string[];
  const maxSeries = Math.max(1, ...(data?.series || []).map((x:any)=>Number(x.views||0)));
  const maxPage = Math.max(1, ...(data?.pages || []).map((x:any)=>Number(x.views||0)));
  const maxClick = Math.max(1, ...(data?.clicks || []).map((x:any)=>Number(x.clicks||0)));
  const maxHour = Math.max(1, ...(data?.hours || []).map((x:any)=>Number(x.views||0)));
  const hourMap = new Map((data?.hours || []).map((x:any)=>[Number(x.hour), x]));

  return <AppShell title="Statistiques du site"><section className="content" style={{display:'grid',gap:22}}>
    <div className="pageTitle" style={{alignItems:'flex-start'}}><div><h1>Statistiques de fréquentation</h1><p className="muted">Visites, clics, pages consultées, heures de consultation et provenance géographique.</p></div><button className="secondary" onClick={()=>load()} disabled={loading}><RefreshCw size={16}/> Actualiser</button></div>

    <div className="card" style={{display:'grid',gap:14}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{([['day','Jour'],['week','Semaine'],['month','Mois'],['year','Année']] as const).map(([key,label])=><button key={key} className={preset===key?'primary':'secondary'} onClick={()=>choose(key)}>{label}</button>)}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,alignItems:'end'}}>
        <label className="field">Du<input type="date" value={from} onChange={(e)=>{setFrom(e.target.value);setPreset('custom')}}/></label>
        <label className="field">Au<input type="date" value={to} onChange={(e)=>{setTo(e.target.value);setPreset('custom')}}/></label>
        <label className="field">Pays<select value={country} onChange={(e)=>{setCountry(e.target.value);setRegion('');setCity('')}}><option value="">Tous les pays</option>{countries.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="field">Région<select value={region} onChange={(e)=>{setRegion(e.target.value);setCity('')}}><option value="">Toutes les régions</option>{regions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="field">Ville<select value={city} onChange={(e)=>setCity(e.target.value)}><option value="">Toutes les villes</option>{cities.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <button className="primary" onClick={()=>load()}><CalendarDays size={16}/> Appliquer</button>
      </div>
      {(country||region||city)&&<div className="muted" style={{display:'flex',gap:8,alignItems:'center'}}><MapPin size={15}/> Filtre actif : {[country,region,city].filter(Boolean).join(' / ')}</div>}
    </div>

    {error&&<div className="alert error">{error}</div>}{loading&&!data&&<div className="card">Chargement des statistiques…</div>}
    {data&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14}}>
        <article className="card"><div className="muted" style={{display:'flex',gap:8}}><Eye size={18}/> Pages vues</div><strong style={{fontSize:34}}>{n(data.totals?.pageViews)}</strong></article>
        <article className="card"><div className="muted" style={{display:'flex',gap:8}}><Users size={18}/> Visiteurs uniques</div><strong style={{fontSize:34}}>{n(data.totals?.uniqueVisitors)}</strong></article>
        <article className="card"><div className="muted" style={{display:'flex',gap:8}}><BarChart3 size={18}/> Sessions</div><strong style={{fontSize:34}}>{n(data.totals?.sessions)}</strong></article>
        <article className="card"><div className="muted" style={{display:'flex',gap:8}}><MousePointerClick size={18}/> Clics suivis</div><strong style={{fontSize:34}}>{n(data.totals?.clicks)}</strong></article>
      </div>

      <article className="card"><h2 style={{marginTop:0}}>Évolution des visites</h2><div style={{height:230,display:'flex',alignItems:'end',gap:6,overflowX:'auto'}}>{(data.series||[]).map((item:any,index:number)=><div key={index} title={`${shortDate(item.bucket,data.range.bucket)} : ${item.views} vues`} style={{height:'100%',minWidth:data.series.length>60?7:20,flex:data.series.length<=30?'1 1 0':'0 0 auto',display:'flex',flexDirection:'column',justifyContent:'end',alignItems:'center',gap:6}}><div style={{width:'100%',maxWidth:36,minHeight:3,height:`${Math.max(3,Number(item.views||0)/maxSeries*180)}px`,background:'#c97a3d',borderRadius:'5px 5px 2px 2px'}}/><small className="muted" style={{fontSize:10,whiteSpace:'nowrap'}}>{data.series.length>60?'':shortDate(item.bucket,data.range.bucket)}</small></div>)}</div></article>

      <article className="card"><div style={{display:'flex',gap:8,alignItems:'center'}}><Clock3 size={20}/><h2 style={{margin:0}}>Heures de consultation</h2></div><p className="muted">Répartition des pages vues selon l’heure locale de chaque visiteur.</p><div style={{height:210,display:'flex',alignItems:'end',gap:5}}>{Array.from({length:24},(_,hour)=>{const item:any=hourMap.get(hour);const views=Number(item?.views||0);return <div key={hour} title={`${hour}h : ${views} vues`} style={{flex:'1 1 0',height:'100%',display:'flex',flexDirection:'column',justifyContent:'end',alignItems:'center',gap:5}}><div style={{width:'80%',minHeight:2,height:`${Math.max(2,views/maxHour*155)}px`,background:'#14213d',borderRadius:'4px 4px 0 0'}}/><small className="muted" style={{fontSize:9}}>{hour%2===0?`${hour}h`:''}</small></div>})}</div></article>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:18}}>
        <article className="card"><h2 style={{marginTop:0}}>Pages les plus consultées</h2><div style={{display:'grid',gap:12}}>{(data.pages||[]).map((item:any)=><div key={item.path}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong>{item.path}</strong><span>{n(item.views)} vues</span></div><div style={{height:7,background:'#eef1f5',borderRadius:999,overflow:'hidden'}}><div style={{height:'100%',width:`${Number(item.views||0)/maxPage*100}%`,background:'#14213d'}}/></div><small className="muted">{n(item.visitors)} visiteurs uniques</small></div>)}</div></article>
        <article className="card"><h2 style={{marginTop:0}}>Éléments les plus cliqués</h2><div style={{display:'grid',gap:12}}>{(data.clicks||[]).map((item:any,index:number)=><div key={index}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong>{item.label||item.target||item.path}</strong><span>{n(item.clicks)}</span></div><div style={{height:7,background:'#eef1f5',borderRadius:999,overflow:'hidden'}}><div style={{height:'100%',width:`${Number(item.clicks||0)/maxClick*100}%`,background:'#c97a3d'}}/></div><small className="muted">Depuis {item.path}{item.target?` → ${item.target}`:''}</small></div>)}</div></article>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:18}}>
        <article className="card"><div style={{display:'flex',gap:8,alignItems:'center'}}><Globe2 size={20}/><h2 style={{margin:0}}>Pays des visiteurs</h2></div><table className="table" style={{marginTop:16}}><thead><tr><th>Pays</th><th>Visiteurs</th></tr></thead><tbody>{(data.geography?.countries||[]).map((item:any)=><tr key={`${item.country}-${item.countryCode}`}><td>{item.country}</td><td>{n(item.visitors)}</td></tr>)}</tbody></table></article>
        <article className="card"><h2 style={{marginTop:0}}>Villes principales</h2><table className="table"><thead><tr><th>Ville</th><th>Pays</th><th>Visiteurs</th></tr></thead><tbody>{(data.geography?.cities||[]).map((item:any,index:number)=><tr key={index}><td>{item.city}</td><td>{item.country}</td><td>{n(item.visitors)}</td></tr>)}</tbody></table></article>
      </div>

      <article className="card"><h2 style={{marginTop:0}}>Dernières consultations</h2><p className="muted">Heure affichée dans le fuseau horaire local du visiteur.</p><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Date & heure locale</th><th>Page</th><th>Pays</th><th>Région</th><th>Ville</th><th>Fuseau</th></tr></thead><tbody>{(data.recentVisits||[]).map((item:any,index:number)=><tr key={index}><td>{item.localTime}</td><td>{item.path}</td><td>{item.country||'—'}</td><td>{item.region||'—'}</td><td>{item.city||'—'}</td><td>{item.timezone||'UTC'}</td></tr>)}</tbody></table></div></article>
      <div className="muted" style={{fontSize:12}}>Les statistiques démarrent à partir du déploiement de ce module. La localisation est approximative ; l’adresse IP brute n’est pas conservée.</div>
    </>}
  </section></AppShell>;
}
