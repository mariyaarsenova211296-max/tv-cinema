import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { asset } from './base';
import { Comparison } from './Comparison';
import { config, phaseOffset, resolvePhase, smooth, totalDistance, clamp } from './config';
import type { Design } from './config';
import { MediaStage } from './MediaStage';
import { useDesignScale } from './useDesignScale';
import { useMotionPreference } from './useMotionPreference';

gsap.registerPlugin(ScrollTrigger);

const emptyDesign: Design = {
  logo: null, menu: [], utilities: [], cta: null, cardsTitle: null, cards: [],
  revealTitle: null, comparisonLabels: null, comparisonFeatures: [], finale: null, comparison: null,
};
/* scene-3 is the static title section outside the sticky experience */
const anchors = [{ id: 4, phase: 'feature' }, { id: 5, phase: 'comparison' }, { id: 6, phase: 'finale' }] as const;

function resolveDesign(raw: Design): Design {
  return {
    ...raw,
    logo: raw.logo ? { ...raw.logo, src: asset(raw.logo.src) } : null,
    utilities: raw.utilities.map(u => ({ ...u, icon: asset(u.icon) })),
    cta: raw.cta ? { ...raw.cta, thumb: asset(raw.cta.thumb) } : null,
    cards: raw.cards.map(c => ({ ...c, src: asset(c.src) })),
    comparisonFeatures: raw.comparisonFeatures.map(f => ({ ...f, icon: asset(f.icon) })),
    comparison: raw.comparison
      ? { ...raw.comparison, mini: asset(raw.comparison.mini), rgb: asset(raw.comparison.rgb) }
      : null,
  };
}

export default function App() {
  const [design, setDesign] = useState<Design>(emptyDesign);
  const [distance, setDistance] = useState(-1);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [inView, setInView] = useState(false);
  const stage = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cardsTrack = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();
  const { phase, progress } = resolvePhase(Math.max(0, distance));
  useDesignScale();

  useEffect(() => {
    const abort = new AbortController();
    fetch(asset('design.json'), { signal: abort.signal }).then(r => { if (!r.ok) throw new Error('Design unavailable'); return r.json(); })
      .then(data => setDesign(resolveDesign({ ...emptyDesign, ...data }))).catch(() => { /* Deliberately no fabricated content. */ });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    let scheduled = 0;
    const update = () => {
      scheduled = 0;
      if (!stage.current) return;
      const rect = stage.current.getBoundingClientRect();
      const viewport = stage.current.querySelector('.stage-sticky')?.clientHeight || innerHeight;
      setDistance(-rect.top / viewport);
      setInView(rect.top <= 1 && rect.bottom >= viewport - 1);
      if (frame.current) setSize({ width: frame.current.clientWidth, height: frame.current.clientHeight });
    };
    const schedule = () => { if (!scheduled) scheduled = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    if (frame.current) observer.observe(frame.current);
    update();
    return () => { cancelAnimationFrame(scheduled); observer.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, []);

  useEffect(() => {
    if (reduced || !cardsTrack.current) return;
    const cards = cardsTrack.current.querySelectorAll('.card');
    if (!cards.length) return;
    const ctx = gsap.context(() => {
      gsap.from(cards, {
        opacity: 0,
        y: 48,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: { trigger: cardsTrack.current, start: 'top 80%', once: true },
      });
    });
    return () => ctx.revert();
  }, [design.cards, reduced]);

  // Title is a static section; sticky stage opens on the full-size TV (no scroll-driven reveal).
  const comparisonOpacity = phase === 'comparison' ? smooth(progress / config.text.enterEnd) : phase === 'orbit' ? 1 - smooth(progress / config.text.leaveEnd) : 0;
  const comparisonActive = phase === 'comparison' && comparisonOpacity > 0.5 && inView;
  const finaleOpacity = phase === 'finale' ? smooth((progress - 0.12) / 0.4) : 0;

  return <>
    <a href="#scene-1" className="skip-link">В начало</a>
    <header className="site-header" data-node-id="1:1110">
      <div className="header-left">
        {design.logo && (
          <a className="brand-link" href="#scene-1" aria-label={design.logo.alt}>
            <img className="brand" src={design.logo.src} alt="" width={48} height={48} />
          </a>
        )}
        {design.menu.some(item => item.primary) && (
          <a className="nav-pill nav-pill--menu" href={design.menu.find(item => item.primary)!.href}>
            <img src={asset('assets/icons/menu.svg')} alt="" width={24} height={24} />
            <span>{design.menu.find(item => item.primary)!.label}</span>
          </a>
        )}
        {design.menu.filter(item => !item.primary).length > 0 && (
          <nav className="nav-group" aria-label="Основное меню">
            {design.menu.filter(item => !item.primary).map(item => (
              <a className={`nav-pill${item.active ? ' is-active' : ''}`} href={item.href} key={item.label}>{item.label}</a>
            ))}
          </nav>
        )}
      </div>
      {design.utilities.length > 0 && (
        <div className="header-right" aria-label="Сервисные действия">
          {design.utilities.map(item => (
            <a className="nav-icon" href={item.href} key={item.label} aria-label={item.label}>
              <img src={item.icon} alt="" width={24} height={24} />
            </a>
          ))}
        </div>
      )}
    </header>

    <main>
      <section id="scene-1" className="intro" aria-label="Экран 1" data-node-id="1:1106" />

      <section id="scene-2" className="cards-section" aria-label="Экран 2" data-node-id="1:1156">
        {design.cardsTitle && <h2 className="cards-title">{design.cardsTitle}</h2>}
        <div className="cards-scroller" tabIndex={0} aria-label="Карточки возможностей">
          <div className="cards-track" ref={cardsTrack}>
            {design.cards.map((card, i) => {
              const image = (
                <img
                  src={card.src}
                  alt={card.alt}
                  loading="lazy"
                  width={card.width}
                  height={700}
                  style={{ aspectRatio: card.aspectRatio }}
                />
              );
              return card.href
                ? <a className="card" key={i} href={card.href} style={{ aspectRatio: card.aspectRatio }}>{image}</a>
                : <div className="card" key={i} role="img" aria-label={card.alt} style={{ aspectRatio: card.aspectRatio }}>{image}</div>;
            })}
          </div>
        </div>
      </section>

      {/* Figma 1:1500 — static title beat; video follows immediately in the sticky stage */}
      <section id="scene-3" className="reveal-section" aria-label="Экран 3" data-node-id="1:1500">
        {design.revealTitle && <h1 className="reveal-title" data-node-id="1:1501">{design.revealTitle}</h1>}
      </section>

      <section className="experience" ref={stage} style={{ '--story-distance': totalDistance } as CSSProperties} aria-label="Экраны 4–6">
        {anchors.map(a => <div className="scene-anchor" id={`scene-${a.id}`} key={a.id} style={{ top: `${phaseOffset(a.phase) / (totalDistance + 1) * 100}%` }} />)}
        <div className="stage-sticky" data-phase={phase} data-progress={progress.toFixed(3)}>
          <div className="visual-position">
            <div className="visual-frame" ref={frame}>
              <MediaStage phase={phase} progress={progress} active={inView} reduced={reduced} />
              <div className="comparison-layer" style={{ opacity: comparisonOpacity, visibility: comparisonOpacity > 0 ? 'visible' : 'hidden' }}>
                <Comparison design={design} width={size.width} height={size.height} interactive={comparisonActive} />
              </div>
            </div>
          </div>
          {design.finale && (
            <div className="finale-copy" style={{ opacity: finaleOpacity }} inert={phase !== 'finale' || undefined}>
              <p className="finale-eyebrow">{design.finale.eyebrow}</p>
              <h2>{design.finale.title}</h2>
              <p>{design.finale.body}</p>
            </div>
          )}
        </div>
      </section>
    </main>

    {design.cta && (
      <div className="cta-panel" id="buy">
        <a className="cta" href={design.cta.href}>
          <img className="cta-thumb" src={design.cta.thumb} alt="" width={96} height={96} />
          <span className="cta-copy">
            <span className="cta-label">{design.cta.label}</span>
            <span className="cta-price">{design.cta.price}</span>
          </span>
        </a>
      </div>
    )}

    <div className="preview-tools" aria-label="Навигация технического предпросмотра">
      <a href={asset('review.html')} title="Материалы и статус реализации" aria-label="Материалы и статус реализации">i</a>
      <nav aria-label="Шесть экранов">{[1, 2, 3, 4, 5, 6].map(n => <a key={n} href={`#scene-${n}`} aria-label={`Экран ${n}`} title={`Экран ${n}`}>{n.toString().padStart(2, '0')}</a>)}</nav>
    </div>
    <span className="sr-only" aria-live="polite">{inView && `Сцена ${phase === 'reveal' || phase === 'zoom' || phase === 'feature' || phase === 'retreat' ? 4 : phase === 'comparison' ? 5 : 6}`}</span>
    <div className="timeline-status" hidden data-distance={clamp(distance, -1, totalDistance)} />
  </>;
}
