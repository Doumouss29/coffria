'use client';
import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Users } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { api } from '../../lib/api';

export default function GroupsPage() {
  const [groups,setGroups]=useState<any[]>([]); const [users,setUsers]=useState<any[]>([]);
  const [name,setName]=useState(''); const [selected,setSelected]=useState<string[]>([]); const [error,setError]=useState('');
  async function load(){ const [g,o]=await Promise.all([api('/groups'),api('/groups/options')]); setGroups(g); setUsers(o.users); }
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function create(e:any){e.preventDefault(); try{await api('/groups',{method:'POST',body:JSON.stringify({name,userIds:selected})});setName('');setSelected([]);await load();}catch(e:any){setError(e.message)}}
  async function save(group:any){try{await api(`/groups/${group.id}`,{method:'PATCH',body:JSON.stringify({name:group.name,userIds:group.members.map((m:any)=>m.user.id)})});await load();}catch(e:any){setError(e.message)}}
  async function remove(id:string){if(!confirm('Supprimer ce groupe ? Les dossiers ne seront pas supprimés.'))return;try{await api(`/groups/${id}`,{method:'DELETE'});await load();}catch(e:any){setError(e.message)}}
  return <AppShell title="Gestion des groupes"><section className="content"><div className="pageTitle"><div><h1>Groupes d’accès</h1><p className="muted">Regroupez les collaborateurs pour attribuer l’accès aux dossiers.</p></div></div>
    {error&&<div className="alert error">{error}</div>}
    <form className="settingsCard" onSubmit={create}><h2>Nouveau groupe</h2><label className="field">Nom<input value={name} onChange={e=>setName(e.target.value)} required/></label><div className="checkGrid">{users.map(u=><label key={u.id} className="checkItem"><input type="checkbox" checked={selected.includes(u.id)} onChange={e=>setSelected(e.target.checked?[...selected,u.id]:selected.filter(id=>id!==u.id))}/><span>{u.name}<small>{u.email} · {u.role}</small></span></label>)}</div><button className="primary"><Plus size={16}/>Créer le groupe</button></form>
    <div className="groupGrid">{groups.map((g:any)=><article className="card groupCard" key={g.id}><div className="tenantHeader"><div><Users size={19}/><input value={g.name} onChange={e=>setGroups(gs=>gs.map(x=>x.id===g.id?{...x,name:e.target.value}:x))}/></div><button className="dangerButton" onClick={()=>remove(g.id)}><Trash2 size={16}/></button></div><div className="checkGrid">{users.map(u=>{const on=g.members.some((m:any)=>m.user.id===u.id);return <label key={u.id} className="checkItem"><input type="checkbox" checked={on} onChange={e=>setGroups(gs=>gs.map(x=>x.id!==g.id?x:{...x,members:e.target.checked?[...x.members,{user:u}]:x.members.filter((m:any)=>m.user.id!==u.id)}))}/><span>{u.name}<small>{u.email}</small></span></label>})}</div><button className="secondary" onClick={()=>save(g)}><Save size={16}/>Enregistrer</button></article>)}</div>
  </section></AppShell>
}
