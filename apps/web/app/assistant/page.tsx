'use client';

import Link from 'next/link';
import { Bot, Database, RefreshCw, Send, Sparkles } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { api } from '../../lib/api';

type Message={role:'user'|'assistant';text:string;citations?:any[]};

export default function AssistantPage(){
  const[question,setQuestion]=useState('');const[messages,setMessages]=useState<Message[]>([]);const[busy,setBusy]=useState(false);const[status,setStatus]=useState<any>(null);const[error,setError]=useState('');
  async function load(){setStatus(await api('/ai/status'))}useEffect(()=>{load().catch(()=>undefined)},[]);
  async function indexAll(){if(!confirm('Indexer ou réindexer les documents accessibles de votre entreprise ?'))return;setBusy(true);setError('');try{const r=await api('/ai/index-all',{method:'POST'});await load();setMessages(m=>[...m,{role:'assistant',text:`Indexation terminée : ${r.indexed} document(s) sur ${r.total}.`}]);}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  async function submit(e:FormEvent){e.preventDefault();const q=question.trim();if(!q||busy)return;setQuestion('');setMessages(m=>[...m,{role:'user',text:q}]);setBusy(true);setError('');try{const r=await api('/ai/chat',{method:'POST',body:JSON.stringify({question:q})});setMessages(m=>[...m,{role:'assistant',text:r.answer,citations:r.citations}]);}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  return <AppShell title="Assistant IA Coffria"><section className="content aiPage">
    <div className="pageTitle"><div><h1>Chat with your Docs</h1><p className="muted">Interrogez uniquement les documents auxquels vous avez accès. Les réponses sont accompagnées de leurs sources.</p></div>{status&&<div className="aiStatus"><Database size={17}/><span>{status.indexedDocuments} document(s) indexé(s) · {status.chunks} passages</span></div>}</div>
    {error&&<div className="alert error">{error}</div>}
    <div className="aiLayout"><aside className="aiIntro"><div className="aiOrb"><Bot size={34}/></div><h2>Assistant documentaire</h2><p>Exemples :</p><button onClick={()=>setQuestion('Quelle est la durée de préavis indiquée dans notre bail commercial ?')}>Durée de préavis du bail</button><button onClick={()=>setQuestion('Fais-moi un résumé des trois derniers devis du fournisseur X.')}>Résumé des derniers devis</button><button onClick={()=>setQuestion('Quels documents parlent de bornage et quelles sont leurs conclusions ?')}>Documents sur le bornage</button><button className="secondary aiIndexButton" disabled={busy} onClick={indexAll}><RefreshCw size={15}/> Réindexer les archives</button></aside>
      <div className="aiChat"><div className="aiMessages">{!messages.length&&<div className="aiEmpty"><Sparkles size={34}/><h3>Posez une question sur vos archives</h3><p>Coffria recherche les passages pertinents dans votre espace documentaire sécurisé avant de générer la réponse.</p></div>}{messages.map((m,i)=><div key={i} className={`aiMessage ${m.role}`}><div className="aiMessageRole">{m.role==='user'?'Vous':'Coffria IA'}</div><div className="aiMessageText">{m.text}</div>{m.citations?.length?<div className="aiCitations"><strong>Sources</strong>{m.citations.map((c:any)=><Link key={`${c.documentId}-${c.index}`} href={`/viewer/${c.documentId}`}><span>[{c.index}] {c.documentName}{c.page?` · page ${c.page}`:''}</span><small>{c.excerpt}</small></Link>)}</div>:null}</div>)}{busy&&<div className="aiMessage assistant"><div className="aiMessageRole">Coffria IA</div><div className="aiTyping">Analyse des archives…</div></div>}</div><form className="aiComposer" onSubmit={submit}><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ex. Quel est le montant indiqué dans le dernier devis de…"/><button className="primary" disabled={busy||!question.trim()}><Send size={17}/> Envoyer</button></form></div>
    </div>
  </section></AppShell>;
}
