import { useRef, useState, useEffect } from 'react';

// Crops the embedded page to its radar canvas only (Meteociel "plein écran"
// look) and scales it to COVER the card — fills width & height, no dark
// margins. The page is rendered at a fixed logical width (frameW) so the canvas
// position (x, y) is deterministic; the visible card width is measured at
// runtime to compute the cover scale.
function CanvasCropFrame({ src, title, height, crop }) {
  const { x, y, size, frameW } = crop;
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = (w ? Math.max(w, height) : height) / size; // cover the card
  const left = (w - size * s) / 2 - x * s;
  const top = (height - size * s) / 2 - y * s;
  return (
    <div ref={ref} style={{ height, overflow: 'hidden', position: 'relative', background: '#0b1220' }}>
      <iframe
        src={src}
        title={title || 'carte'}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{
          position: 'absolute', left, top, border: 0,
          width: `${frameW}px`,
          height: `${y + size + 60}px`,
          transform: `scale(${s})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}

// Generic iframe wrapper for the weather live maps (RainViewer, Blitzortung,
// Windy, Meteociel). Rounded card with a title bar.
// `scale` < 1 zooms the embedded page out so a large page fits inside a short
// card; `panY`/`panX` (negative px) shift the content up/left to skip a page
// header or sidebar. `canvasCrop` ({ x, y, size, frameW }) crops to the radar
// canvas and covers the card.
export default function MapEmbed({ title, src, height = 320, note, scale = 1, panY = 0, panX = 0, canvasCrop = null }) {
  const titleBar = title && (
    <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
      <span className="text-sm font-heading font-semibold text-white/70">{title}</span>
      {note && <span className="text-[11px] text-white/30">{note}</span>}
    </div>
  );

  if (canvasCrop) {
    return (
      <div className="glass-card overflow-hidden">
        {titleBar}
        <CanvasCropFrame src={src} title={title} height={height} crop={canvasCrop} />
      </div>
    );
  }

  const scaled = scale !== 1 || panY !== 0 || panX !== 0;
  return (
    <div className="glass-card overflow-hidden">
      {titleBar}
      {scaled ? (
        <div style={{ height, overflow: 'hidden', position: 'relative' }}>
          <iframe
            src={src}
            title={title || 'carte'}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{
              position: 'absolute', top: panY, left: panX, border: 0,
              width: `calc(${100 / scale}% + ${Math.abs(panX) / scale}px)`,
              height: `${(height - panY) / scale}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      ) : (
        <iframe
          src={src}
          title={title || 'carte'}
          loading="lazy"
          className="w-full block border-0"
          style={{ height }}
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
}
