// Generic iframe wrapper for the weather live maps (RainViewer, Blitzortung,
// Windy, Meteociel). Rounded card with a title bar.
// `scale` < 1 zooms the embedded page out so a large page fits inside a short
// card; `panY` (negative px) shifts the content up to skip a page header.
export default function MapEmbed({ title, src, height = 320, note, scale = 1, panY = 0 }) {
  const scaled = scale !== 1 || panY !== 0;
  return (
    <div className="glass-card overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
          <span className="text-sm font-heading font-semibold text-white/70">{title}</span>
          {note && <span className="text-[11px] text-white/30">{note}</span>}
        </div>
      )}
      {scaled ? (
        <div style={{ height, overflow: 'hidden', position: 'relative' }}>
          <iframe
            src={src}
            title={title || 'carte'}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{
              position: 'absolute', top: panY, left: 0, border: 0,
              width: `${100 / scale}%`,
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
