// Generic iframe wrapper for the weather live maps (RainViewer, Blitzortung,
// Windy). Rounded card with a title bar.
export default function MapEmbed({ title, src, height = 320, note }) {
  return (
    <div className="glass-card overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
          <span className="text-sm font-heading font-semibold text-white/70">{title}</span>
          {note && <span className="text-[11px] text-white/30">{note}</span>}
        </div>
      )}
      <iframe
        src={src}
        title={title || 'carte'}
        loading="lazy"
        className="w-full block border-0"
        style={{ height }}
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
