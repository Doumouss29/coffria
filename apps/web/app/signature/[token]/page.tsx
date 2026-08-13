'use client';

import { useParams } from 'next/navigation';
import { CheckCircle2, ChevronLeft, ChevronRight, Eraser, FileSignature, PenLine, ShieldCheck, XCircle } from 'lucide-react';
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './signature.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const API=process.env.NEXT_PUBLIC_API_URL;
async function publicApi(path:string,init:RequestInit={}){const r=await fetch(`${API}${path}`,{...init,headers:{'Content-Type':'application/json',...(init.headers||{})}});const j=await r.json().catch(()=>({message:r.statusText}));if(!r.ok)throw new Error(j.message||'Erreur');return j;}

export default function PublicSignaturePage(){
  const params=useParams<{token:string}>();
  const token=params.token;
  const[data,setData]=useState<any>(null);
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);
  const[done,setDone]=useState(false);
  const[hasInk,setHasInk]=useState(false);
  const[pageNumber,setPageNumber]=useState(1);
  const[pageCount,setPageCount]=useState(1);
  const[pdfReady,setPdfReady]=useState(false);
  const[rendering,setRendering]=useState(false);
  const pdfRef=useRef<any>(null);
  const pdfCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const inkCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawingRef=useRef(false);

  useEffect(()=>{
    publicApi(`/signatures/public/${encodeURIComponent(token)}`)
      .then((value)=>{setData(value);setPageNumber(1);setPageCount(value.pageCount||1)})
      .catch(e=>setError(e.message));
  },[token]);

  useEffect(()=>{
    if(!data?.documentUrl||data?.waiting)return;
    let cancelled=false;
    setPdfReady(false);setError('');
    const task=pdfjsLib.getDocument({url:data.documentUrl});
    task.promise.then((pdf:any)=>{
      if(cancelled)return;
      pdfRef.current=pdf;setPageCount(pdf.numPages||data.pageCount||1);setPdfReady(true);
    }).catch((e:any)=>{if(!cancelled)setError(`Impossible d'afficher le PDF : ${e?.message||'erreur de chargement'}`)});
    return()=>{cancelled=true;try{task.destroy()}catch{};pdfRef.current=null};
  },[data?.documentUrl,data?.waiting]);

  useEffect(()=>{
    if(!pdfReady||!pdfRef.current)return;
    let cancelled=false;
    async function render(){
      setRendering(true);
      try{
        const page=await pdfRef.current.getPage(pageNumber);
        if(cancelled)return;
        const base=page.getViewport({scale:1});
        const targetWidth=Math.min(1100,Math.max(760,base.width*1.45));
        const viewport=page.getViewport({scale:targetWidth/base.width});
        const pdfCanvas=pdfCanvasRef.current;const inkCanvas=inkCanvasRef.current;
        if(!pdfCanvas||!inkCanvas)return;
        pdfCanvas.width=Math.ceil(viewport.width);pdfCanvas.height=Math.ceil(viewport.height);
        inkCanvas.width=pdfCanvas.width;inkCanvas.height=pdfCanvas.height;
        clearInk();
        const ctx=pdfCanvas.getContext('2d');if(!ctx)return;
        await page.render({canvasContext:ctx,viewport}).promise;
      }catch(e:any){if(!cancelled)setError(`Impossible d'afficher la page ${pageNumber} : ${e?.message||'erreur'}`)}finally{if(!cancelled)setRendering(false)}
    }
    render();
    return()=>{cancelled=true};
  },[pdfReady,pageNumber]);

  function clearInk(){
    const canvas=inkCanvasRef.current;if(canvas)canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
    setHasInk(false);drawingRef.current=false;
  }
  function point(e:ReactPointerEvent<HTMLCanvasElement>){
    const canvas=e.currentTarget;const rect=canvas.getBoundingClientRect();
    return{x:(e.clientX-rect.left)*(canvas.width/rect.width),y:(e.clientY-rect.top)*(canvas.height/rect.height)};
  }
  function startDraw(e:ReactPointerEvent<HTMLCanvasElement>){
    if(rendering)return;
    const canvas=e.currentTarget;canvas.setPointerCapture(e.pointerId);drawingRef.current=true;
    const ctx=canvas.getContext('2d');if(!ctx)return;const p=point(e);
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineWidth=Math.max(2.8,canvas.width/330);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#14213d';
  }
  function draw(e:ReactPointerEvent<HTMLCanvasElement>){
    if(!drawingRef.current)return;const ctx=e.currentTarget.getContext('2d');if(!ctx)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();setHasInk(true);
  }
  function stopDraw(e:ReactPointerEvent<HTMLCanvasElement>){drawingRef.current=false;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}}
  function changePage(next:number){
    const n=Math.max(1,Math.min(next,pageCount));if(n===pageNumber)return;
    if(hasInk&&!confirm('Changer de page effacera le tracé en cours. Continuer ?'))return;
    clearInk();setPageNumber(n);setError('');
  }
  function cropSignature(){
    const source=inkCanvasRef.current;if(!source||!hasInk)throw new Error('Signez directement sur le document avant de valider.');
    const ctx=source.getContext('2d');if(!ctx)throw new Error('Signature indisponible.');
    const image=ctx.getImageData(0,0,source.width,source.height);let minX=source.width,minY=source.height,maxX=-1,maxY=-1;
    for(let y=0;y<source.height;y++){for(let x=0;x<source.width;x++){if(image.data[(y*source.width+x)*4+3]>8){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}}
    if(maxX<0)throw new Error('Aucun tracé détecté.');
    const pad=Math.max(12,Math.round(source.width*.015));minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(source.width-1,maxX+pad);maxY=Math.min(source.height-1,maxY+pad);
    const out=document.createElement('canvas');out.width=maxX-minX+1;out.height=maxY-minY+1;out.getContext('2d')?.drawImage(source,minX,minY,out.width,out.height,0,0,out.width,out.height);
    return out.toDataURL('image/png');
  }
  function overlayImage(){const canvas=inkCanvasRef.current;if(!canvas||!hasInk)throw new Error('Signez directement sur le document avant de valider.');return canvas.toDataURL('image/png');}

  async function sign(e:FormEvent){
    e.preventDefault();setError('');
    if(!hasInk){setError('Utilisez le stylo directement sur le document avant de valider.');return;}
    if(!confirm(`Confirmer la signature de la page ${pageNumber} ? Le tracé visible sera intégré exactement à cet emplacement dans le PDF.`))return;
    setBusy(true);
    try{
      await publicApi(`/signatures/public/${encodeURIComponent(token)}/sign`,{method:'POST',body:JSON.stringify({signatureText:data.recipient.name,signatureImage:cropSignature(),signatureOverlay:overlayImage(),pageNumber,position:'direct-page'})});
      setDone(true);
    }catch(e:any){setError(e.message)}finally{setBusy(false)}
  }
  async function refuse(){const reason=prompt('Motif du refus (facultatif)')||'';if(!confirm('Confirmer le refus de signer ce document ?'))return;setBusy(true);try{await publicApi(`/signatures/public/${encodeURIComponent(token)}/refuse`,{method:'POST',body:JSON.stringify({reason})});setDone(true)}catch(e:any){setError(e.message)}finally{setBusy(false)}}

  if(error&&!data)return <main className="signaturePublicPage"><div className="signaturePublicCard"><XCircle size={42}/><h1>Signature indisponible</h1><p>{error}</p></div></main>;
  if(!data)return <main className="signaturePublicPage"><div className="signaturePublicCard"><p>Chargement de la demande de signature…</p></div></main>;
  if(done)return <main className="signaturePublicPage"><div className="signaturePublicCard success"><CheckCircle2 size={52}/><h1>Merci</h1><p>Votre tracé manuscrit a été intégré directement à la page du document et enregistré dans Coffria.</p></div></main>;
  if(data.waiting)return <main className="signaturePublicPage"><div className="signaturePublicCard"><ShieldCheck size={44}/><h1>{data.request.title}</h1><p>Le document attend encore la signature d’une personne placée avant vous dans le circuit. Votre lien restera valide et vous pourrez revenir ici ensuite.</p></div></main>;

  return <main className="signaturePublicPage">
    <div className="signaturePublicHeader"><div className="brand">Coffr<span>i</span>a</div><span>Signature sécurisée</span></div>
    <div className="signaturePublicLayout directInkLayout">
      <section className="signatureDocument directInkDocument">
        <div className="signatureDocumentToolbar directInkToolbar">
          <div className="pageNav"><button type="button" onClick={()=>changePage(pageNumber-1)} disabled={pageNumber<=1}><ChevronLeft size={18}/></button><strong>Page {pageNumber} / {pageCount}</strong><button type="button" onClick={()=>changePage(pageNumber+1)} disabled={pageNumber>=pageCount}><ChevronRight size={18}/></button></div>
          <div className="penStatus"><PenLine size={17}/><strong>Stylo actif</strong><span>Signez directement sur la page</span></div>
          <button type="button" className="signatureClear" onClick={clearInk} disabled={!hasInk}><Eraser size={16}/> Effacer</button>
        </div>
        <div className="directPdfViewport">
          {!pdfReady&&<div className="pdfLoading">Chargement du document…</div>}
          <div className="directPdfPage" aria-busy={rendering}>
            <canvas ref={pdfCanvasRef} className="pdfRenderCanvas"/>
            <canvas ref={inkCanvasRef} className="pdfInkCanvas" onPointerDown={startDraw} onPointerMove={draw} onPointerUp={stopDraw} onPointerCancel={stopDraw} onPointerLeave={(e)=>{if(drawingRef.current&&e.buttons===0)stopDraw(e)}}/>
            {rendering&&<div className="pageRendering">Affichage de la page…</div>}
          </div>
        </div>
      </section>
      <aside className="signaturePanel directInkPanel">
        <FileSignature size={35}/><h1>{data.request.title}</h1>
        <p className="muted">Document : {data.request.documentName}</p>
        {data.request.message&&<div className="signatureMessage">{data.request.message}</div>}
        <div className="signatureProgress"><strong>Circuit de signature</strong>{data.request.recipients.map((r:any)=><div key={r.order}><span>{r.order}. {r.name}</span><small>{r.status==='SIGNED'?'Signé':r.status==='REFUSED'?'Refusé':'En attente'}</small></div>)}</div>
        <form onSubmit={sign}>
          <div className="directInkInstructions"><PenLine size={22}/><div><strong>Signez directement sur le document</strong><span>Avec le doigt, le stylet ou la souris, tracez votre signature exactement à l’endroit voulu sur la page affichée. Il n’y a plus d’étape de placement.</span></div></div>
          {error&&<div className="signatureInlineError">{error}</div>}
          <p className="signatureConsent">Le tracé visible sur la page {pageNumber} sera fusionné avec le PDF à la même position. Coffria conserve la date, l’adresse IP, le navigateur et l’empreinte du document à titre de traçabilité.</p>
          <button className="publicPrimary full" disabled={busy||!hasInk||rendering}>{busy?'Intégration de la signature…':'Valider cette signature'}</button>
          <button type="button" className="dangerButton full" disabled={busy} onClick={refuse}>Refuser de signer</button>
        </form>
      </aside>
    </div>
  </main>;
}
