// Generic iframe wrapper for the weather live maps (RainViewer, Blitzortung,
// Windy, Meteociel). Rounded card with a title bar.
// `scale` < 1 zooms the embedded page out so a large page fits inside a short
// card; `panY`/`panX` (negative px) shift the content up/left to skip a page
// header or sidebar.
// `canvasCrop` ({ x, y, size, frameW }) renders the page at a fixed logical
// width (frameW) and crops to the radar canvas region only — the equivalent of
// Meteociel's "plein écran" view (just the map, no menus), scaled to the card
// height and centred horizontally.
export default function MapEmbed({ title, src, height = 320, note, scale = 1, panY = 0, panX = 0, canvasCrop = null }) {
  const titleBar = title && (
    <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
      <span className="text-sm font-heading font-semibold text-white/70">{title}</span>
      {note && <span className="text-[11px] text-white/30">{note}</span>}
    </div>
  );

  if (canvasCrop) {
    const { x, y, size, frameW } = canvasCrop;
    const s = height / size;          // fit the square canvas to the card height
    const shown = size * s;           // == height (square radar side, in px)
    return (
      <div className="glass-card overflow-hidden">
        {titleBar}
        <div style={{ height, overflow: 'hidden', display: 'flex', justifyContent: 'center', background: '#0b1220' }}>
          <div style={{ width: shown, maxWidth: '100%', height, overflow: 'hidden', position: 'relative', flex: '0 0 auto' }}>
            <iframe
              src={src}
              title={title || 'carte'}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{
                position: 'absolute', left: -x * s, top: -y * s, border: 0,
                width: `${frameW}px`,
                height: `${y + size + 60}px`,
                transform: `scale(${s})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        </div>
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
