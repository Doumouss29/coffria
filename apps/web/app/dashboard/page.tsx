'use client';
import { useEffect, useState } from 'react';
import { FileText, Folder, HardDrive, Trash2, Users } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { api } from '../../lib/api';
function size(v:any){let n=Number(v||0);for(const u of ['o','Ko','Mo','Go','To']){if(n<1024)return `${n.toFixed(1)} ${u}`;n/=1024}return `${n.toFixed(1)} Po`}
export default function Dashboard(){const[data,setData]=useState<any>(null);const[error,setError]=useState('');useEffect(()=>{api('/dashboard').then(setData).catch(e=>setError(e.message))},[]);return <AppShell title="Tableau de bord"><section className="content"><h1>Tableau de bord</h1>{error&&<div className="alert error">{error}</div>}{data&&<><h2>{data.tenant.name}</h2><div className="stats"><div className="stat"><Folder/><b>{data.folders}</b><span>Dossiers</span></div><div className="stat"><FileText/><b>{data.documents}</b><span>Documents</span></div><div className="stat"><Users/><b>{data.users}</b><span>Utilisateurs</span></div><div className="stat"><Trash2/><b>{data.trashed}</b><span>En corbeille</span></div><div className="stat"><HardDrive/><b>{size(data.storage.usedBytes)}</b><span>sur {size(data.storage.limitBytes)}</span></div></div></>}</section></AppShell>}
