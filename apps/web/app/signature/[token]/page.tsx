'use client';

import { useParams } from 'next/navigation';
import { CheckCircle2, Eraser, FileSignature, PenLine, ShieldCheck, XCircle } from 'lucide-react';
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import './signature.css';

const API=process.env.NEXT_PUBLIC_API_URL;
async function publicApi(path:string,init:RequestInit={}){const r=await fetch(`${API}${path}`,{...init,headers:{'Content-Type':'application/json',...(init.headers||{})}});const j=await r.json().catch(()=>({message:r.statusText}));if(!r.ok)throw new Error(j.message||'Erreur');return j;}

type Position='top-left'|'top-center'|'top-right'|'middle-left'|'middle-center'|'middle-right'|'bottom-left'|'bottom-center'|'bottom-right';
const positionLabels:Record<Position,string>={
  'top-left':'Haut gauche','top-center':'Haut centre','top-right':'Haut droite',
  'middle-left':'Milieu gauche','middle-center':'Milieu centre','middle-right':'Milieu droite',
  'bottom-left':'Bas gauche','bottom-center':'Bas centre','bottom-right':'Bas droite',
};

export default function PublicSignaturePage(){
  const params=useParams<{token:string}>();
  const token=params.token;
  const[data,setData]=useState<any>(null);
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);
  const[done,setDone]=useState(false);
  const[hasInk,setHasInk]=useState(false);
  const[pageNumber,setPageNumber]=useState(1);
  const[position,setPosition]=useState<Position>('bottom-right');
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawingRef=useRef(false);

  useEffect(()=>{
    publicApi(`/signatures/public/${encodeURIComponent(token)}`)
      .then((value)=>{setData(value);if(value?.pageCount)setPageNumber(value.pageCount)})
      .catch(e=>setError(e.message));
  },[token]);

  function point(e:ReactPointerEvent<HTMLCanvasElement>){
    const canvas=e.currentTarget;const rect=canvas.getBoundingClientRect();
    return {x:(e.clientX-rect.left)*(canvas.width/rect.width),y:(e.clientY-rect.top)*(canvas.height/rect.height)};
  }
  function startDraw(e:ReactPointerEvent<HTMLCanvasElement>){
    const canvas=e.currentTarget;canvas.setPointerCapture(e.pointerId);drawingRef.current=true;
    const ctx=canvas.getContext('2d');if(!ctx)return;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineWidth=3.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#14213d';
  }
  function draw(e:ReactPointerEvent<HTMLCanvasElement>){
    if(!drawingRef.current)return;const ctx=e.currentTarget.getContext('2d');if(!ctx)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();setHasInk(true);
  }
  function stopDraw(e:ReactPointerEvent<HTMLCanvasElement>){
    drawingRef.current=false;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}
  }
  function clearSignature(){
    const canvas=canvasRef.current;if(!canvas)return;canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);setHasInk(false);
  }
  function signatureImage(){
    const canvas=canvasRef.current;if(!canvas||!hasInk)throw new Error('Dessinez votre signature avant de valider.');
    return canvas.toDataURL('image/png');
  }

  async function sign(e:FormEvent){
    e.preventDefault();setError('');
    if(!hasInk){setError('Dessinez votre signature dans le cadre avant de valider.');return;}
    if(!confirm(`Confirmer la signature du document ? Votre signature manuscrite sera intégrée à la page ${pageNumber} (${positionLabels[position]}). La date, l’adresse IP et le navigateur seront conservés à titre de preuve Coffria.`))return;
    setBusy(true);
    try{
      await publicApi(`/signatures/public/${encodeURIComponent(token)}/sign`,{method:'POST',body:JSON.stringify({signatureText:data.recipient.name,signatureImage:signatureImage(),pageNumber,position})});
      setDone(true);
    }catch(e:any){setError(e.message)}finally{setBusy(false)}
  }
  async function refuse(){
    const reason=prompt('Motif du refus (facultatif)')||'';if(!confirm('Confirmer le refus de signer ce document ?'))return;setBusy(true);
    try{await publicApi(`/signatures/public/${encodeURIComponent(token)}/refuse`,{method:'POST',body:JSON.stringify({reason})});setDone(true)}catch(e:any){setError(e.message)}finally{setBusy(false)}
  }

  if(error&&!data)return <main className="signaturePublicPage"><div className="signaturePublicCard"><XCircle size={42}/><h1>Signature indisponible</h1><p>{error}</p></div></main>;
  if(!data)return <main className="signaturePublicPage"><div className="signaturePublicCard"><p>Chargement de la demande de signature…</p></div></main>;
  if(done)return <main className="signaturePublicPage"><div className="signaturePublicCard success"><CheckCircle2 size={52}/><h1>Merci</h1><p>Votre signature a bien été intégrée au document et enregistrée dans Coffria.</p></div></main>;
  if(data.waiting)return <main className="signaturePublicPage"><div className="signaturePublicCard"><ShieldCheck size={44}/><h1>{data.request.title}</h1><p>Le document attend encore la signature d’une personne placée avant vous dans le circuit. Votre lien restera valide et vous pourrez revenir ici ensuite.</p></div></main>;

  return <main className="signaturePublicPage">
    <div className="signaturePublicHeader"><div className="brand">Coffr<span>i</span>a</div><span>Signature sécurisée</span></div>
    <div className="signaturePublicLayout">
      <section className="signatureDocument"><iframe src={data.documentUrl} title={data.request.documentName}/></section>
      <aside className="signaturePanel">
        <FileSignature size={35}/><h1>{data.request.title}</h1>
        <p className="muted">Document : {data.request.documentName}</p>
        {data.request.message&&<div className="signatureMessage">{data.request.message}</div>}
        <div className="signatureProgress"><strong>Circuit de signature</strong>{data.request.recipients.map((r:any)=><div key={r.order}><span>{r.order}. {r.name}</span><small>{r.status==='SIGNED'?'Signé':r.status==='REFUSED'?'Refusé':'En attente'}</small></div>)}</div>
        <form onSubmit={sign}>
          <div className="drawSignatureBlock">
            <div className="drawSignatureHead"><span><PenLine size={18}/> Dessinez votre signature</span><button type="button" className="signatureClear" onClick={clearSignature}><Eraser size={16}/> Effacer</button></div>
            <p className="signatureHint">Signez avec le doigt sur mobile ou avec la souris/stylet sur ordinateur.</p>
            <canvas ref={canvasRef} width={600} height={180} className="signatureCanvas" onPointerDown={startDraw} onPointerMove={draw} onPointerUp={stopDraw} onPointerCancel={stopDraw} onPointerLeave={(e)=>{if(drawingRef.current&&e.buttons===0)stopDraw(e)}}/>
          </div>
          <div className="signaturePlacement">
            <label>Page du document<input type="number" min={1} max={data.pageCount||undefined} value={pageNumber} onChange={e=>setPageNumber(Math.max(1,Math.min(Number(e.target.value)||1,data.pageCount||999999)))}/>{data.pageCount&&<small>sur {data.pageCount} page{data.pageCount>1?'s':''}</small>}</label>
            <label>Emplacement<select value={position} onChange={e=>setPosition(e.target.value as Position)}>{(Object.keys(positionLabels) as Position[]).map(p=><option key={p} value={p}>{positionLabels[p]}</option>)}</select></label>
          </div>
          {error&&<div className="signatureInlineError">{error}</div>}
          <p className="signatureConsent">En cliquant sur « Signer le document », votre tracé manuscrit sera intégré directement au PDF. Coffria conserve également les éléments de traçabilité de la signature.</p>
          <button className="publicPrimary full" disabled={busy||!hasInk}>{busy?'Intégration de la signature…':'Signer le document'}</button>
          <button type="button" className="dangerButton full" disabled={busy} onClick={refuse}>Refuser de signer</button>
        </form>
      </aside>
    </div>
  </main>;
}
