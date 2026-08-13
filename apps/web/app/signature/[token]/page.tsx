'use client';

import { useParams } from 'next/navigation';
import { CheckCircle2, Eraser, FileSignature, Move, PenLine, ShieldCheck, XCircle } from 'lucide-react';
import { FormEvent, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import './signature.css';

const API=process.env.NEXT_PUBLIC_API_URL;
async function publicApi(path:string,init:RequestInit={}){const r=await fetch(`${API}${path}`,{...init,headers:{'Content-Type':'application/json',...(init.headers||{})}});const j=await r.json().catch(()=>({message:r.statusText}));if(!r.ok)throw new Error(j.message||'Erreur');return j;}

type Position='top-left'|'top-center'|'top-right'|'middle-left'|'middle-center'|'middle-right'|'bottom-left'|'bottom-center'|'bottom-right';
const positionLabels:Record<Position,string>={
  'top-left':'Haut gauche','top-center':'Haut centre','top-right':'Haut droite',
  'middle-left':'Milieu gauche','middle-center':'Milieu centre','middle-right':'Milieu droite',
  'bottom-left':'Bas gauche','bottom-center':'Bas centre','bottom-right':'Bas droite',
};
const positionPoint:Record<Position,{x:number;y:number}>={
  'top-left':{x:17,y:17},'top-center':{x:50,y:17},'top-right':{x:83,y:17},
  'middle-left':{x:17,y:50},'middle-center':{x:50,y:50},'middle-right':{x:83,y:50},
  'bottom-left':{x:17,y:83},'bottom-center':{x:50,y:83},'bottom-right':{x:83,y:83},
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
  const[placing,setPlacing]=useState(false);
  const[signaturePreview,setSignaturePreview]=useState('');
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawingRef=useRef(false);

  useEffect(()=>{
    publicApi(`/signatures/public/${encodeURIComponent(token)}`)
      .then((value)=>{setData(value);setPageNumber(1)})
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
    setTimeout(()=>{const c=canvasRef.current;if(c)setSignaturePreview(c.toDataURL('image/png'))},0);
  }
  function clearSignature(){
    const canvas=canvasRef.current;if(!canvas)return;canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);setHasInk(false);setSignaturePreview('');setPlacing(false);
  }
  function signatureImage(){
    const canvas=canvasRef.current;if(!canvas||!hasInk)throw new Error('Dessinez votre signature avant de valider.');
    return canvas.toDataURL('image/png');
  }
  function beginPlacement(){
    if(!hasInk){setError('Dessinez d’abord votre signature.');return;}
    setError('');setSignaturePreview(signatureImage());setPlacing(true);
  }
  function choosePlacement(e:ReactMouseEvent<HTMLDivElement>){
    const rect=e.currentTarget.getBoundingClientRect();
    const rx=(e.clientX-rect.left)/rect.width;const ry=(e.clientY-rect.top)/rect.height;
    const h=rx<1/3?'left':rx<2/3?'center':'right';
    const v=ry<1/3?'top':ry<2/3?'middle':'bottom';
    setPosition(`${v}-${h}` as Position);setPlacing(false);
  }
  function changePage(value:number){
    const max=data?.pageCount||1;setPageNumber(Math.max(1,Math.min(value||1,max)));setPlacing(false);
  }

  async function sign(e:FormEvent){
    e.preventDefault();setError('');
    if(!hasInk){setError('Dessinez votre signature dans le cadre avant de valider.');return;}
    if(!confirm(`Confirmer la signature du document ? Votre signature manuscrite sera intégrée directement à la page ${pageNumber} (${positionLabels[position]}). La date, l’adresse IP et le navigateur seront conservés à titre de preuve Coffria.`))return;
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
  if(done)return <main className="signaturePublicPage"><div className="signaturePublicCard success"><CheckCircle2 size={52}/><h1>Merci</h1><p>Votre signature a bien été intégrée directement au document et enregistrée dans Coffria.</p></div></main>;
  if(data.waiting)return <main className="signaturePublicPage"><div className="signaturePublicCard"><ShieldCheck size={44}/><h1>{data.request.title}</h1><p>Le document attend encore la signature d’une personne placée avant vous dans le circuit. Votre lien restera valide et vous pourrez revenir ici ensuite.</p></div></main>;

  const pdfUrl=`${String(data.documentUrl).split('#')[0]}#page=${pageNumber}&zoom=page-width`;
  const previewPoint=positionPoint[position];

  return <main className="signaturePublicPage">
    <div className="signaturePublicHeader"><div className="brand">Coffr<span>i</span>a</div><span>Signature sécurisée</span></div>
    <div className="signaturePublicLayout">
      <section className="signatureDocument">
        <div className="signatureDocumentToolbar">
          <label>Page <input type="number" min={1} max={data.pageCount||1} value={pageNumber} onChange={e=>changePage(Number(e.target.value))}/><span>/ {data.pageCount||1}</span></label>
          <button type="button" className={placing?'placementButton active':'placementButton'} disabled={!hasInk} onClick={beginPlacement}><Move size={17}/>{placing?'Touchez le document':'Placer ma signature'}</button>
        </div>
        <div className="signatureDocumentStage">
          <iframe key={`${pageNumber}-${data.documentUrl}`} src={pdfUrl} title={data.request.documentName}/>
          {signaturePreview&&<img className="signatureOnDocumentPreview" src={signaturePreview} alt="Aperçu de votre signature" style={{left:`${previewPoint.x}%`,top:`${previewPoint.y}%`}}/>}
          {placing&&<div className="signaturePlacementOverlay" onClick={choosePlacement}><div><Move size={24}/><strong>Touchez l’endroit où signer</strong><span>La signature sera intégrée à la page {pageNumber}</span></div></div>}
        </div>
      </section>
      <aside className="signaturePanel">
        <FileSignature size={35}/><h1>{data.request.title}</h1>
        <p className="muted">Document : {data.request.documentName}</p>
        {data.request.message&&<div className="signatureMessage">{data.request.message}</div>}
        <div className="signatureProgress"><strong>Circuit de signature</strong>{data.request.recipients.map((r:any)=><div key={r.order}><span>{r.order}. {r.name}</span><small>{r.status==='SIGNED'?'Signé':r.status==='REFUSED'?'Refusé':'En attente'}</small></div>)}</div>
        <form onSubmit={sign}>
          <div className="drawSignatureBlock">
            <div className="drawSignatureHead"><span><PenLine size={18}/> 1. Dessinez votre signature</span><button type="button" className="signatureClear" onClick={clearSignature}><Eraser size={16}/> Effacer</button></div>
            <p className="signatureHint">Signez avec le doigt sur mobile ou avec la souris/stylet sur ordinateur.</p>
            <canvas ref={canvasRef} width={600} height={180} className="signatureCanvas" onPointerDown={startDraw} onPointerMove={draw} onPointerUp={stopDraw} onPointerCancel={stopDraw} onPointerLeave={(e)=>{if(drawingRef.current&&e.buttons===0)stopDraw(e)}}/>
          </div>
          <div className="directPlacementCallout">
            <strong>2. Placez la signature directement sur le document</strong>
            <span>Choisissez la page puis utilisez le bouton « Placer ma signature » au-dessus du PDF. Touchez ensuite la zone du document où la signature doit apparaître.</span>
            <button type="button" className="secondary full" disabled={!hasInk} onClick={beginPlacement}><Move size={17}/> Placer sur la page {pageNumber}</button>
            <small>Position actuelle : {positionLabels[position]}</small>
          </div>
          {error&&<div className="signatureInlineError">{error}</div>}
          <p className="signatureConsent">En cliquant sur « Signer le document », le tracé visible dans l’aperçu sera intégré au PDF sur la page sélectionnée. Coffria conserve également les éléments de traçabilité.</p>
          <button className="publicPrimary full" disabled={busy||!hasInk}>{busy?'Intégration de la signature…':'Signer le document'}</button>
          <button type="button" className="dangerButton full" disabled={busy} onClick={refuse}>Refuser de signer</button>
        </form>
      </aside>
    </div>
  </main>;
}
