'use client';

import { Hand, PenLine, ZoomIn, ZoomOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

export default function SignatureInteractionControls() {
  const pathname = usePathname();
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  const [signingEnabled, setSigningEnabled] = useState(false);
  const [zoom, setZoom] = useState(1);

  const isSignaturePage = pathname?.startsWith('/signature/');

  useEffect(() => {
    if (!isSignaturePage) {
      setToolbar(null);
      return;
    }

    const locate = () => {
      const node = document.querySelector<HTMLElement>('.directInkToolbar');
      setToolbar(node);
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isSignaturePage]);

  useEffect(() => {
    if (!isSignaturePage) return;

    const applyMode = () => {
      document.querySelectorAll<HTMLCanvasElement>('.pdfInkCanvas').forEach((canvas) => {
        canvas.style.pointerEvents = signingEnabled ? 'auto' : 'none';
        canvas.style.touchAction = signingEnabled ? 'none' : 'pan-x pan-y pinch-zoom';
        canvas.style.cursor = signingEnabled ? 'crosshair' : 'grab';
        canvas.setAttribute('aria-label', signingEnabled ? 'Zone de signature active' : 'Document en mode navigation');
      });
    };

    applyMode();
    const observer = new MutationObserver(applyMode);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [isSignaturePage, signingEnabled]);

  useEffect(() => {
    if (!isSignaturePage) return;

    const applyZoom = () => {
      document.querySelectorAll<HTMLElement>('.directPdfPage').forEach((page) => {
        page.style.width = `${Math.round(zoom * 100)}%`;
        page.style.maxWidth = zoom > 1 ? 'none' : '1100px';
      });
    };

    applyZoom();
    const observer = new MutationObserver(applyZoom);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isSignaturePage, zoom]);

  useEffect(() => {
    if (!isSignaturePage) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.savedSignatureBox button')) setSigningEnabled(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [isSignaturePage]);

  if (!isSignaturePage || !toolbar) return null;

  const controls = (
    <div className="signatureInteractionControls" role="group" aria-label="Navigation et signature">
      <div className="signatureModeSwitch">
        <button
          type="button"
          className={!signingEnabled ? 'active' : ''}
          onClick={() => setSigningEnabled(false)}
          title="Naviguer sans dessiner"
        >
          <Hand size={17} /> <span>Navigation</span>
        </button>
        <button
          type="button"
          className={signingEnabled ? 'active signing' : ''}
          onClick={() => setSigningEnabled(true)}
          title="Activer le stylo de signature"
        >
          <PenLine size={17} /> <span>Signer</span>
        </button>
      </div>
      <div className="signatureZoomControls">
        <button type="button" onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))} disabled={zoom <= MIN_ZOOM} aria-label="Dézoomer" title="Dézoomer"><ZoomOut size={17} /></button>
        <button type="button" className="zoomValue" onClick={() => setZoom(1)} title="Réinitialiser le zoom">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))} disabled={zoom >= MAX_ZOOM} aria-label="Zoomer" title="Zoomer"><ZoomIn size={17} /></button>
      </div>
    </div>
  );

  return createPortal(controls, toolbar);
}
