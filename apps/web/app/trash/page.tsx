'use client';
import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { api } from '../../lib/api';

export default function TrashPage(){
  const[data,setData]=useState<any>({folders:[],documents:[]});
  const[error,setError]=useState('');
  const[selectedDocs,setSelectedDocs]=useState<string[]>([]);
  const[selectedFolders,setSelectedFolders]=useState<string[]>([]);
  async function load(){setData(await api('/trash'));setSelectedDocs([]);setSelectedFolders([])}
  useEffect(()=>{load().catch(e=>setError(e.message))},[]);
  const count=selectedDocs.length+selectedFolders.length;
  const allRows=useMemo(()=>[...(data.folders||[]).map((x:any)=>({...x,kind:'folder'})),...(data.documents||[]).map((x:any)=>({...x,kind:'document'}))],[data]);
  function toggle(item:any,checked:boolean){if(item.kind==='folder')setSelectedFolders(v=>checked?[...v,item.id]:v.filter(x=>x!==item.id));else setSelectedDocs(v=>checked?[...v,item.id]:v.filter(x=>x!==item.id))}
  function selected(item:any){return item.kind==='folder'?selectedFolders.includes(item.id):selectedDocs.includes(item.id)}
  function toggleAll(checked:boolean){if(!checked){setSelectedDocs([]);setSelectedFolders([]);return;}setSelectedFolders((data.folders||[]).map((x:any)=>x.id));setSelectedDocs((data.documents||[]).map((x:any)=>x.id))}
  async function bulk(action:'restore'|'purge'){
    if(!count)return;
    if(action==='purge'&&!confirm(`Supprimer définitivement ${count} élément(s) ? Cette action est irréversible.`))return;
    try{await api(`/bulk/trash/${action}`,{method:'POST',body:JSON.stringify({documentIds:selectedDocs,folderIds:selectedFolders})});await load()}catch(e:any){setError(e.message)}
  }
  async function restore(id:string){try{await api('/bulk/trash/restore',{method:'POST',body:JSON.stringify({documentIds:[id],folderIds:[]})});await load()}catch(e:any){setError(e.message)}}
  async function purge(id:string,name:string){if(!confirm(`Supprimer définitivement « ${name} » ?`))return;try{await api('/bulk/trash/purge',{method:'POST',body:JSON.stringify({documentIds:[id],folderIds:[]})});await load()}catch(e:any){setError(e.message)}}
  async function restoreFolder(id:string){try{await api('/bulk/trash/restore',{method:'POST',body:JSON.stringify({documentIds:[],folderIds:[id]})});await load()}catch(e:any){setError(e.message)}}
  async function purgeFolder(id:string,name:string){if(!confirm(`Supprimer définitivement le dossier « ${name} » et son contenu ?`))return;try{await api('/bulk/trash/purge',{method:'POST',body:JSON.stringify({documentIds:[],folderIds:[id]})});await load()}catch(e:any){setError(e.message)}}
  return <AppShell title="Corbeille"><section className="content"><div className="pageTitle"><div><h1>Corbeille</h1><p className="muted">Restaurez ou supprimez définitivement plusieurs fichiers et dossiers en une seule opération.</p></div></div>{error&&<div className="alert error">{error}</div>}{count>0&&<div className="bulkBar"><strong>{count} sélectionné(s)</strong><button className="secondary" onClick={()=>bulk('restore')}><RotateCcw size={16}/> Restaurer</button><button className="dangerButton" onClick={()=>bulk('purge')}><Trash2 size={16}/> Supprimer définitivement</button></div>}<div className="card"><table className="table"><thead><tr><th><input type="checkbox" checked={allRows.length>0&&count===allRows.length} onChange={e=>toggleAll(e.target.checked)}/></th><th>Nom</th><th>Type</th><th>Supprimé le</th><th>Actions</th></tr></thead><tbody>{!allRows.length&&<tr><td colSpan={5} className="empty">La corbeille est vide.</td></tr>}{allRows.map((item:any)=><tr key={`${item.kind}-${item.id}`}><td><input type="checkbox" checked={selected(item)} onChange={e=>toggle(item,e.target.checked)}/></td><td>{item.name}</td><td>{item.kind==='folder'?'Dossier':item.mimeType}</td><td>{new Date(item.deletedAt).toLocaleString('fr-FR')}</td><td><div className="rowActions"><button onClick={()=>item.kind==='folder'?restoreFolder(item.id):restore(item.id)} title="Restaurer"><RotateCcw size={17}/></button><button onClick={()=>item.kind==='folder'?purgeFolder(item.id,item.name):purge(item.id,item.name)} title="Supprimer définitivement"><Trash2 size={17}/></button></div></td></tr>)}</tbody></table></div></section></AppShell>}
