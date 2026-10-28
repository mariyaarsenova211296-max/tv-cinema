import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { asset } from './base';
import { Comparison } from './Comparison';
import {
  autoplayLockStart,
  breathMediaScale,
  config,
  phaseOffset,
  resolveBreathStory,
  smooth,
  totalDistance,
  clamp,
} from './config';
import type { Design } from './config';
import { FeatureSlider } from './FeatureSlider';
import { IntroStage } from './IntroStage';
import { MediaStage } from './MediaStage';
import { useDesignScale } from './useDesignScale';
import { useMotionPreference } from './useMotionPreference';

gsap.registerPlugin(ScrollTrigger);

const emptyDesign: Design = {
  logo: null, menu: [], utilities: [], cta: null, cardsTitle: null, cards: [],
  revealTitle: null, comparisonLabels: null, comparisonFeatures: [], finale: null, ambience: null,
  neverObsolete: null, comparison: null,
};
/* scene-3 is the static title section outside the sticky experience */
const anchors = [
  { id: 4, phase: 'approach' as const },
  { id: 5, phase: 'comparison' as const },
  { id: 6, phase: 'utpDlg' as const },
  { id: 7, phase: 'orbit' as const },
  { id: 8, phase: 'finale' as const },
  { id: 9, phase: 'ambience' as const },
  { id: 10, phase: 'rotate' as const },
];

function resolveDesign(raw: Design): Design {
  return {
    ...raw,
    logo: raw.logo ? { ...raw.logo, src: asset(raw.logo.src) } : null,
    utilities: raw.utilities.map(u => ({ ...u, icon: asset(u.icon) })),
    cta: raw.cta ? { ...raw.cta, thumb: asset(raw.cta.thumb) } : null,
    cards: raw.cards.map(c => ({ ...c, src: asset(c.src) })),
    comparisonFeatures: raw.comparisonFeatures.map(f => ({ ...f, icon: asset(f.icon) })),
    neverObsolete: raw.neverObsolete
      ? {
          ...raw.neverObsolete,
          utps: raw.neverObsolete.utps.map(u => ({ ...u, icon: asset(u.icon) })),
        }
      : null,
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
  const [autoplayDone, setAutoplayDone] = useState(false);
  const [unlockDistance, setUnlockDistance] = useState(0);
  const stage = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cardsTrack = useRef<HTMLDivElement>(null);
  const distanceRef = useRef(distance);
  distanceRef.current = distance;
  const reduced = useMotionPreference();
  const { phase, progress } = resolveBreathStory(
    Math.max(0, distance),
    autoplayDone,
    unlockDistance,
  );
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

  // Soft Shopify-like entrances (text/cards only — never touch feature video assets).
  useEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.from('.site-header', { opacity: 0, y: -14, duration: 1.05, ease: 'power3.out' });
      gsap.from('.cta', { opacity: 0, y: 18, duration: 1.15, delay: 0.12, ease: 'power3.out' });
      if (cardsTrack.current) {
        const cards = cardsTrack.current.querySelectorAll('.card');
        gsap.from('.cards-title', {
          opacity: 0,
          y: 36,
          duration: 1.15,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.cards-section', start: 'top 78%', once: true },
        });
        if (cards.length) {
          gsap.from(cards, {
            opacity: 0,
            y: 56,
            duration: 1.15,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: { trigger: cardsTrack.current, start: 'top 82%', once: true },
          });
        }
      }
      gsap.from('.reveal-title', {
        opacity: 0,
        y: 28,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.reveal-section', start: 'top 75%', once: true },
      });
    });
    return () => ctx.revert();
  }, [design.cards, design.cta, reduced]);

  // Reverse past approach end → re-arm autoplay; leave sticky upward also clears.
  useEffect(() => {
    if (!autoplayDone) return;
    if (distance < 0 || distance < autoplayLockStart) {
      setAutoplayDone(false);
      setUnlockDistance(0);
    }
  }, [distance, autoplayDone]);

  const handleAutoplayDone = () => {
    // Freeze unlock: mid-play scroll discarded; NEW scroll only for retreat→UTP.
    setUnlockDistance(Math.max(autoplayLockStart, distanceRef.current));
    setAutoplayDone(true);
  };

  const mediaOpacity = reduced
    ? 1
    : phase === 'approach'
      ? smooth((progress - config.reveal.from) / Math.max(0.001, config.reveal.to - config.reveal.from))
      : 1;
  const mediaScale = breathMediaScale(phase, progress);

  // Feature slider retired on main breath path.
  const featureSliderOpacity = 0;
  const featureSliderActive = false;

  // Exactly two UTPs: RGB → DLG (Mini LED removed).
  const utpPhases = phase === 'comparison' || phase === 'utpDlg';
  const activeUtpIndex = phase === 'comparison' ? 0 : phase === 'utpDlg' ? 1 : -1;
  const utpOpacity = (() => {
    if (!utpPhases) return 0;
    if (progress < config.text.enterEnd) return smooth(progress / config.text.enterEnd);
    if (progress > 1 - config.text.leaveEnd) {
      return 1 - smooth((progress - (1 - config.text.leaveEnd)) / config.text.leaveEnd);
    }
    return 1;
  })();
  const utpActive = utpPhases && utpOpacity > 0.5 && inView;
  const activeUtp = activeUtpIndex >= 0 && utpOpacity > 0.01 ? design.comparisonFeatures[activeUtpIndex] : null;
  const utpIn = utpOpacity > 0.08;

  // Dolby copy only after orbit — during finale (not during camera retreat).
  const finaleOpacity = phase === 'finale'
    ? (progress > 0.88 ? 1 - smooth((progress - 0.88) / 0.12) : smooth((progress - 0.08) / 0.35))
    : 0;
  const ambienceCopyIn = phase === 'ambience' && progress >= config.ambience.turnOnAt;
  const ambienceCopyOpacity = phase === 'ambience' && progress >= config.ambience.turnOnAt
    ? smooth((progress - config.ambience.turnOnAt) / 0.22)
    : 0;

  const inObsoleteScene = phase === 'rotate' || phase === 'obsolete';
  const obsoleteTitleOpacity = phase === 'rotate'
    ? smooth((progress - config.rotate.titleIn) / Math.max(0.001, config.rotate.titleEnd - config.rotate.titleIn))
    : phase === 'obsolete' ? 1 : 0;
  const obsoleteBodyOpacity = phase === 'rotate'
    ? smooth((progress - config.rotate.bodyIn) / Math.max(0.001, config.rotate.bodyEnd - config.rotate.bodyIn))
    : phase === 'obsolete' ? 1 : 0;
  const obsoleteLift = phase === 'obsolete' ? smooth(progress) * config.obsolete.liftPx : 0;
  const obsoleteUtpOpacity = phase === 'obsolete'
    ? smooth((progress - config.obsolete.utpIn) / Math.max(0.001, config.obsolete.utpEnd - config.obsolete.utpIn))
    : 0;
  // Breath scale lives on MediaStage (--breath-scale); media-layer only lifts in obsolete.
  const layerTransform = obsoleteLift > 0.5
    ? `translate3d(0, ${-obsoleteLift}px, 0)`
    : undefined;

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
      <IntroStage reduced={reduced} />

      <section id="scene-2" className="cards-section" aria-label="Экран 2" data-node-id="72:1095">
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

      <section id="scene-3" className="reveal-section" aria-label="Экран 3" data-node-id="1:1500">
        {design.revealTitle && <h1 className="reveal-title" data-node-id="1:1501">{design.revealTitle}</h1>}
      </section>

      <section className="experience" ref={stage} style={{ '--story-distance': totalDistance } as CSSProperties} aria-label="Экраны 4–8">
        {anchors.map(a => <div className="scene-anchor" id={`scene-${a.id}`} key={a.id} style={{ top: `${phaseOffset(a.phase) / (totalDistance + 1) * 100}%` }} />)}
        <div className="scene-anchor" id="scene-10" style={{ top: `${phaseOffset('obsolete') / (totalDistance + 1) * 100}%` }} />
        <div
          className="stage-sticky"
          data-phase={phase}
          data-progress={progress.toFixed(3)}
          data-autoplay={autoplayDone ? 'done' : phase === 'autoplay' ? 'play' : 'pending'}
        >
          <div className="visual-position">
            <div className="visual-frame" ref={frame}>
              <div
                className="media-layer"
                style={{
                  opacity: mediaOpacity,
                  visibility: mediaOpacity > 0.01 ? 'visible' : 'hidden',
                  transform: layerTransform,
                }}
              >
                <MediaStage
                  phase={phase}
                  progress={progress}
                  active={inView}
                  reduced={reduced}
                  breathScale={mediaScale}
                  onAutoplayDone={handleAutoplayDone}
                />
              </div>
              <div
                className="feature-slider-layer"
                style={{ opacity: featureSliderOpacity, visibility: 'hidden' }}
                aria-hidden="true"
              >
                <FeatureSlider design={design} interactive={featureSliderActive} />
              </div>
              <div className="comparison-layer" style={{ opacity: 0, visibility: 'hidden' }} aria-hidden="true">
                <Comparison design={design} width={size.width} height={size.height} />
              </div>
            </div>
          </div>
          {activeUtp && (
            <div
              className={`comparison-features comparison-features--single${utpIn ? ' is-in' : ''}`}
              data-testid="comparison-features"
              data-node-id={activeUtpIndex === 0 ? '72:1975' : '72:1938'}
              data-figma-frame={activeUtpIndex === 0 ? '72:1864' : '81:1994'}
              style={{ opacity: utpOpacity }}
              inert={!utpActive || undefined}
            >
              <article className="feature-block feature-block--single" key={activeUtp.title}>
                <img src={activeUtp.icon} alt="" width={64} height={64} />
                <div className="feature-block__copy">
                  <h2>{activeUtp.title}</h2>
                  <p>{activeUtp.body}</p>
                </div>
              </article>
            </div>
          )}
          {design.finale && (
            <div className={`finale-copy${finaleOpacity > 0.2 ? ' is-in' : ''}`} style={{ opacity: finaleOpacity }} inert={phase !== 'finale' || undefined}>
              <p className="finale-eyebrow">{design.finale.eyebrow}</p>
              <h2>{design.finale.title}</h2>
              <p>{design.finale.body}</p>
            </div>
          )}
          <div
            className={`ambience-copy${ambienceCopyIn ? ' is-in' : ''}`}
            data-node-id="28:541"
            style={{ opacity: ambienceCopyOpacity }}
            inert={!ambienceCopyIn || undefined}
          >
            <h2>{design.ambience?.title ?? 'Атмосферная\nподсветка'}</h2>
            <p>{design.ambience?.body ?? 'Создает ощущение настоящего кинотеатра\nу вас в доме'}</p>
          </div>
          <div
            className={`obsolete-copy${obsoleteTitleOpacity > 0.2 ? ' is-in' : ''}`}
            data-node-id="54:848"
            data-testid="obsolete-copy"
            style={{
              opacity: Math.max(obsoleteTitleOpacity, obsoleteBodyOpacity) > 0.01 ? 1 : 0,
              pointerEvents: inObsoleteScene ? 'none' : undefined,
            }}
            inert={!inObsoleteScene || undefined}
          >
            <h2 style={{ opacity: obsoleteTitleOpacity }}>
              {design.neverObsolete?.title ?? 'Кинотеатр, который не устареет'}
            </h2>
            <p style={{ opacity: obsoleteBodyOpacity }}>
              {design.neverObsolete?.body ?? 'Платформа постоянно обновляется, а технологии будут актуальны ещё долго'}
            </p>
          </div>
          {design.neverObsolete && design.neverObsolete.utps.length > 0 && (
            <div
              className={`obsolete-utps${obsoleteUtpOpacity > 0.35 ? ' is-in' : ''}`}
              data-node-id="60:946"
              data-testid="obsolete-utps"
              style={{ opacity: obsoleteUtpOpacity }}
              inert={obsoleteUtpOpacity < 0.4 || undefined}
            >
              {design.neverObsolete.utps.map(utp => (
                <article className="obsolete-utp" key={utp.title}>
                  <img src={utp.icon} alt="" width={64} height={64} />
                  <h3>{utp.title}</h3>
                  <p>{utp.body}</p>
                </article>
              ))}
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

    <span className="sr-only" aria-live="polite">{inView && `Сцена ${
      phase === 'approach' || phase === 'autoplay' || phase === 'waitClose' || phase === 'retreat' ? 4
        : phase === 'comparison' || phase === 'utpDlg' ? 5
          : phase === 'orbit' || phase === 'finale' ? 6
            : phase === 'ambience' ? 7
              : 8
    }`}</span>
    <div className="timeline-status" hidden data-distance={clamp(distance, -1, totalDistance)} data-autoplay={autoplayDone ? '1' : '0'} />
  </>;
}
