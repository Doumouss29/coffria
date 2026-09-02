'use client';

import { Hand, PenLine, ZoomIn, ZoomOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

export default function SignatureInteractionControls() {
  const pathname = usePathname();
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  const [signingEnabled, setSigningEnabled] = useState(false);
  const [zoom, setZoom] = useState(1);
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);

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
        canvas.style.touchAction = signingEnabled ? 'none' : 'pan-x pan-y';
        canvas.style.cursor = signingEnabled ? 'crosshair' : 'grab';
        canvas.style.imageRendering = 'auto';
        canvas.setAttribute('aria-label', signingEnabled ? 'Zone de signature active' : 'Document en mode navigation');
      });

      document.querySelectorAll<HTMLElement>('.directPdfViewport').forEach((viewport) => {
        viewport.style.touchAction = signingEnabled ? 'none' : 'pan-x pan-y';
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
        page.style.flexShrink = '0';
      });
    };

    applyZoom();
    const observer = new MutationObserver(applyZoom);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isSignaturePage, zoom]);

  useEffect(() => {
    if (!isSignaturePage) return;

    const distance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const isInsidePdfViewport = (event: TouchEvent) =>
      event.target instanceof Element && Boolean(event.target.closest('.directPdfViewport'));

    const onTouchStart = (event: TouchEvent) => {
      if (signingEnabled || event.touches.length !== 2 || !isInsidePdfViewport(event)) return;
      event.preventDefault();
      pinchStartDistance.current = distance(event.touches);
      pinchStartZoom.current = zoom;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (signingEnabled || event.touches.length !== 2 || !isInsidePdfViewport(event)) return;
      const startDistance = pinchStartDistance.current;
      if (!startDistance) return;
      event.preventDefault();
      const ratio = distance(event.touches) / startDistance;
      const nextZoom = clampZoom(pinchStartZoom.current * ratio);
      setZoom(Math.round(nextZoom * 20) / 20);
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchStartDistance.current = null;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isSignaturePage, signingEnabled, zoom]);

  useEffect(() => {
    if (!isSignaturePage) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.savedSignatureBox button')) setSigningEnabled(true);
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [isSignaturePage]);

  useEffect(() => {
    if (!isSignaturePage || typeof CanvasRenderingContext2D === 'undefined') return;

    const prototype = CanvasRenderingContext2D.prototype;
    const originalMoveTo = prototype.moveTo;
    const originalLineTo = prototype.lineTo;
    const originalQuadraticCurveTo = prototype.quadraticCurveTo;
    const originalStroke = prototype.stroke;
    const callOriginalStroke = originalStroke as unknown as Function;
    const previousPoints = new WeakMap<CanvasRenderingContext2D, { x: number; y: number }>();

    const isInkContext = (context: CanvasRenderingContext2D) =>
      context.canvas instanceof HTMLCanvasElement && context.canvas.classList.contains('pdfInkCanvas');

    prototype.moveTo = function moveTo(this: CanvasRenderingContext2D, x: number, y: number) {
      if (isInkContext(this)) previousPoints.set(this, { x, y });
      return originalMoveTo.call(this, x, y);
    };

    prototype.lineTo = function lineTo(this: CanvasRenderingContext2D, x: number, y: number) {
      if (isInkContext(this)) {
        const previous = previousPoints.get(this);
        if (previous) {
          originalQuadraticCurveTo.call(
            this,
            previous.x,
            previous.y,
            (previous.x + x) / 2,
            (previous.y + y) / 2,
          );
          previousPoints.set(this, { x, y });
          return;
        }
        previousPoints.set(this, { x, y });
      }
      return originalLineTo.call(this, x, y);
    };

    prototype.stroke = function stroke(this: CanvasRenderingContext2D, path?: Path2D) {
      if (isInkContext(this)) {
        this.lineCap = 'round';
        this.lineJoin = 'round';
        this.lineWidth = Math.max(this.lineWidth, Math.max(2.2, this.canvas.width / 520));
      }
      return path ? callOriginalStroke.call(this, path) : callOriginalStroke.call(this);
    } as typeof prototype.stroke;

    return () => {
      prototype.moveTo = originalMoveTo;
      prototype.lineTo = originalLineTo;
      prototype.stroke = originalStroke;
    };
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
        <button
          type="button"
          onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Dézoomer"
          title="Dézoomer"
        >
          <ZoomOut size={17} />
        </button>
        <button
          type="button"
          className="zoomValue"
          onClick={() => setZoom(1)}
          title="Réinitialiser le zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoomer"
          title="Zoomer"
        >
          <ZoomIn size={17} />
        </button>
      </div>
    </div>
  );

  return createPortal(controls, toolbar);
}
