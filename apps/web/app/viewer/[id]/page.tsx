'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, Maximize2, Minus, Plus, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type Pt={x:number;y:number};
type Shape={type:'line'|'polyline'|'circle';points?:Pt[];x?:number;y?:number;r?:number};

function parseDxf(raw:string){
  const lines=raw.replace(/\r/g,'').split('\n');
  const pairs:Array<[number,string]>=[];
  for(let i=0;i+1<lines.length;i+=2)pairs.push([Number(lines[i].trim()),lines[i+1].trim()]);
  const shapes:Shape[]=[];let i=0;
  while(i<pairs.length){
    const [code,value]=pairs[i];
    if(code!==0||!['LINE','LWPOLYLINE','CIRCLE'].includes(value)){i++;continue;}
    const type=value;const props:Array<[number,string]>=[];i++;
    while(i<pairs.length&&pairs[i][0]!==0){props.push(pairs[i]);i++;}
    const nums=(c:number)=>props.filter(p=>p[0]===c).map(p=>Number(p[1]));
    if(type==='LINE'){const xs=nums(10),ys=nums(20),x2=nums(11),y2=nums(21);if(xs.length&&ys.length&&x2.length&&y2.length)shapes.push({type:'line',points:[{x:xs[0],y:ys[0]},{x:x2[0],y:y2[0]}]});}
    if(type==='LWPOLYLINE'){const xs=nums(10),ys=nums(20);const pts=xs.map((x,j)=>({x,y:ys[j]??0}));if(pts.length>1)shapes.push({type:'polyline',points:pts});}
    if(type==='CIRCLE'){const x=nums(10)[0],y=nums(20)[0],r=nums(40)[0];if(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(r))shapes.push({type:'circle',x,y,r});}
  }
  return shapes;
}
function bounds(shapes:Shape[]){
  const pts:Pt[]=[];for(const s of shapes){if(s.points)pts.push(...s.points);if(s.type==='circle'&&s.x!=null&&s.y!=null&&s.r!=null)pts.push({x:s.x-s.r,y:s.y-s.r},{x:s.x+s.r,y:s.y+s.r});}
  if(!pts.length)return{x:0,y:0,w:100,h:100};const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const pad=Math.max(maxX-minX,maxY-minY)*.05||10;return{x:minX-pad,y:minY-pad,w:maxX-minX+pad*2,h:maxY-minY+pad*2};
}

export default function ViewerPage(){
  const params=useParams<{id:string}>();const[id]=[params.id];
  const[data,setData]=useState<any>(null);const[error,setError]=useState('');const[dxf,setDxf]=useState<Shape[]>([]);const[zoom,setZoom]=useState(1);
  const[pdf,setPdf]=useState<any>(null);const[pdfPage,setPdfPage]=useState(1);const[pdfCount,setPdfCount]=useState(1);const[pdfRendering,setPdfRendering]=useState(false);const pdfCanvasRef=useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{api(`/preview/${id}`).then(async(r)=>{setData(r);if(r.kind==='dxf'){const text=await fetch(r.url).then(x=>x.text());setDxf(parseDxf(text));}}).catch(e=>setError(e.message));},[id]);

  useEffect(()=>{
    if(data?.kind!=='pdf'||!data?.url)return;
    let cancelled=false;
    const task=pdfjsLib.getDocument({url:data.url});
    task.promise.then((loaded:any)=>{if(cancelled)return;setPdf(loaded);setPdfCount(loaded.numPages||1);setPdfPage(1);}).catch((e:any)=>{if(!cancelled)setError(`Impossible d'afficher le PDF : ${e?.message||'erreur'}`)});
    return()=>{cancelled=true;try{task.destroy()}catch{};setPdf(null)};
  },[data?.kind,data?.url]);

  useEffect(()=>{
    if(!pdf||data?.kind!=='pdf')return;
    let cancelled=false;let renderTask:any;
    (async()=>{
      setPdfRendering(true);
      try{
        const page=await pdf.getPage(pdfPage);if(cancelled)return;
        const base=page.getViewport({scale:1});
        const hostWidth=Math.max(280,Math.min(1200,(pdfCanvasRef.current?.parentElement?.clientWidth||base.width)-24));
        const viewport=page.getViewport({scale:hostWidth/base.width});
        const canvas=pdfCanvasRef.current;if(!canvas)return;
        canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        const ctx=canvas.getContext('2d');if(!ctx)return;
        renderTask=page.render({canvasContext:ctx,viewport});await renderTask.promise;
      }catch(e:any){if(!cancelled&&e?.name!=='RenderingCancelledException')setError(`Impossible d'afficher la page ${pdfPage} : ${e?.message||'erreur'}`)}finally{if(!cancelled)setPdfRendering(false)}
    })();
    return()=>{cancelled=true;try{renderTask?.cancel()}catch{}};
  },[pdf,pdfPage,data?.kind]);

  const box=useMemo(()=>bounds(dxf),[dxf]);
  if(error)return <AppShell title="Visionneuse"><section className="content"><div className="alert error">{error}</div></section></AppShell>;
  if(!data)return <AppShell title="Visionneuse"><section className="content"><p>Chargement du document…</p></section></AppShell>;
  return <AppShell title="Visionneuse documentaire"><section className="viewerPage">
    <div className="viewerToolbar"><Link href="/explorer" className="secondary"><ArrowLeft size={16}/> Retour</Link><div className="viewerTitle"><strong>{data.name}</strong><span>{(data.extension||data.mimeType||'fichier').toUpperCase()}</span></div>{data.downloadUrl&&<a className="secondary viewerDownload" href={data.downloadUrl}><Download size={16}/> Télécharger</a>}</div>
    <div className="viewerCanvas">
      {data.kind==='pdf'&&<div className="pdfViewer"><div className="pdfPageTools"><button type="button" onClick={()=>setPdfPage(p=>Math.max(1,p-1))} disabled={pdfPage<=1}><ChevronLeft size={18}/> <span>Précédente</span></button><strong>Page {pdfPage} / {pdfCount}</strong><button type="button" onClick={()=>setPdfPage(p=>Math.min(pdfCount,p+1))} disabled={pdfPage>=pdfCount}><span>Suivante</span> <ChevronRight size={18}/></button></div><div className="pdfCanvasWrap"><canvas ref={pdfCanvasRef} className="pdfDocumentCanvas"/>{pdfRendering&&<div className="pdfRendering">Chargement de la page…</div>}</div></div>}
      {data.kind==='image'&&<div className="imagePreview"><img src={data.url} alt={data.name}/></div>}
      {data.kind==='text'&&<pre className="textPreview">{data.text}</pre>}
      {data.kind==='office'&&<div className="officePreview"><FileText size={48}/><h2>{data.name}</h2>{data.text?<pre>{data.text}</pre>:<><p>Le contenu textuel n'est pas encore indexé. Lancez l'indexation depuis l'Assistant IA pour rendre ce document consultable dans Coffria.</p><a className="publicPrimary" href={data.downloadUrl}>Télécharger le fichier</a></>}</div>}
      {data.kind==='dxf'&&<div className="cadPreview"><div className="cadTools"><button type="button" aria-label="Zoom avant" onClick={()=>setZoom(z=>Math.min(8,z*1.25))}><Plus size={18}/></button><button type="button" aria-label="Zoom arrière" onClick={()=>setZoom(z=>Math.max(.25,z/1.25))}><Minus size={18}/></button><button type="button" aria-label="Réinitialiser le zoom" onClick={()=>setZoom(1)}><RefreshCcw size={18}/></button><span>{dxf.length} entités rendues</span></div><svg viewBox={`${box.x} ${-box.y-box.h} ${box.w/zoom} ${box.h/zoom}`} preserveAspectRatio="xMidYMid meet">{dxf.map((s,index)=>s.type==='line'?<line key={index} x1={s.points![0].x} y1={-s.points![0].y} x2={s.points![1].x} y2={-s.points![1].y}/>:s.type==='polyline'?<polyline key={index} points={s.points!.map(p=>`${p.x},${-p.y}`).join(' ')}/>:<circle key={index} cx={s.x} cy={-s.y!} r={s.r}/>)}</svg></div>}
      {data.kind==='dwg'&&<div className="officePreview"><Maximize2 size={48}/><h2>Prévisualisation DWG</h2><p>{data.message}</p><a className="publicPrimary" href={data.url}>Télécharger le DWG</a></div>}
      {data.kind==='generic'&&<div className="officePreview"><FileText size={48}/><h2>Prévisualisation non disponible pour ce format</h2><a className="publicPrimary" href={data.downloadUrl}>Télécharger</a></div>}
    </div>
  </section></AppShell>;
}
