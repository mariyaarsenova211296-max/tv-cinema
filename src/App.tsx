import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { asset } from './base';
import {
  breathMediaScale,
  breathScrubSec,
  config,
  dlgOpacityAt,
  isBreathPhase,
  phaseOffset,
  resolvePhase,
  rgbBodyOpacityAt,
  rgbTitleOpacityAt,
  smooth,
  totalDistance,
  clamp,
} from './config';
import type { Design } from './config';
import { Continuation } from './Continuation';
import { IntroStage } from './IntroStage';
import { MediaStage } from './MediaStage';
import { useDesignScale } from './useDesignScale';
import { useMotionPreference } from './useMotionPreference';

gsap.registerPlugin(ScrollTrigger);

const emptyDesign: Design = {
  logo: null,
  menu: [],
  utilities: [],
  cta: null,
  cardsTitle: null,
  cards: [],
  revealTitle: null,
  comparisonLabels: null,
  comparisonFeatures: [],
  finale: null,
  ambience: null,
  neverObsolete: null,
  remote: null,
  comparison: null,
  breathSpace: null,
};

const anchors = [
  { id: 4, phase: 'breathStart' as const },
  { id: 5, phase: 'breathPlanet' as const },
  { id: 6, phase: 'breathDlg' as const },
  { id: '5to6', phase: 'toSound' as const },
  { id: 7, phase: 'finale' as const },
  { id: 8, phase: 'ambience' as const },
  { id: 9, phase: 'rotate' as const },
];

const defaultBreathCopy = {
  rgbTitle: 'RGB MINI LED',
  rgbBody:
    'Топовая технология экрана. Высокая детализация и насыщенный чёрный цвет без серых пятен',
  dlgTitle: 'DLG 288 Гц',
  dlgBody:
    'Картинка адаптируется под динамичный контент. Увеличенная скорость обновления экрана',
};

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
  const [inView, setInView] = useState(false);
  const stage = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cardsTrack = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();
  const { phase, progress } = resolvePhase(Math.max(0, distance));
  useDesignScale();

  useEffect(() => {
    const abort = new AbortController();
    fetch(asset('design.json'), { signal: abort.signal })
      .then(r => {
        if (!r.ok) throw new Error('Design unavailable');
        return r.json();
      })
      .then(data => setDesign(resolveDesign({ ...emptyDesign, ...data })))
      .catch(() => { /* no fabricated content */ });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    let scheduled = 0;
    const update = () => {
      scheduled = 0;
      if (!stage.current) return;
      const rect = stage.current.getBoundingClientRect();
      const viewport =
        stage.current.querySelector('.stage-sticky')?.clientHeight || innerHeight;
      const next = -rect.top / viewport;
      setDistance(next);
      setInView(rect.top <= 1 && rect.bottom >= viewport - 1);
    };
    const schedule = () => {
      if (!scheduled) scheduled = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    return () => {
      cancelAnimationFrame(scheduled);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

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

  const mediaOpacity = reduced
    ? 1
    : phase === 'breathStart'
      ? smooth(
          (progress - config.reveal.from)
            / Math.max(0.001, config.reveal.to - config.reveal.from),
        )
      : 1;
  const mediaScale = breathMediaScale(phase, progress);

  const copy = {
    ...defaultBreathCopy,
    ...(design.breathSpace ?? {}),
  };
  const scrubT = isBreathPhase(phase)
    ? (breathScrubSec(phase, progress) ?? 0)
    : phase === 'toSound'
      ? config.timebase.lastFrameSec
      : -1;
  const rgbOp = scrubT >= 0 ? rgbTitleOpacityAt(scrubT) : 0;
  const rgbBodyOp = scrubT >= 0 ? rgbBodyOpacityAt(scrubT) : 0;
  const dlgOp = scrubT >= 0 ? dlgOpacityAt(scrubT) : 0;

  const finaleOpacity = phase === 'finale'
    ? (progress > 0.88
      ? 1 - smooth((progress - 0.88) / 0.12)
      : smooth((progress - 0.08) / 0.35))
    : 0;
  const ambienceCopyIn = phase === 'ambience' && progress >= config.ambience.turnOnAt;
  const ambienceCopyOpacity =
    phase === 'ambience' && progress >= config.ambience.turnOnAt
      ? smooth((progress - config.ambience.turnOnAt) / 0.22)
      : 0;

  const inObsoleteScene = phase === 'rotate' || phase === 'obsolete';
  const obsoleteTitleOpacity = phase === 'rotate'
    ? smooth(
        (progress - config.rotate.titleIn)
          / Math.max(0.001, config.rotate.titleEnd - config.rotate.titleIn),
      )
    : phase === 'obsolete' ? 1 : 0;
  const obsoleteBodyOpacity = phase === 'rotate'
    ? smooth(
        (progress - config.rotate.bodyIn)
          / Math.max(0.001, config.rotate.bodyEnd - config.rotate.bodyIn),
      )
    : phase === 'obsolete' ? 1 : 0;
  const obsoleteLift = phase === 'obsolete' ? smooth(progress) * config.obsolete.liftPx : 0;
  const obsoleteUtpOpacity = phase === 'obsolete'
    ? smooth(
        (progress - config.obsolete.utpIn)
          / Math.max(0.001, config.obsolete.utpEnd - config.obsolete.utpIn),
      )
    : 0;
  const layerTransform = obsoleteLift > 0.5
    ? `translate3d(0, ${-obsoleteLift}px, 0)`
    : undefined;

  const sceneLabel = (() => {
    if (isBreathPhase(phase)) {
      if (phase === 'breathDlg') return 5;
      if (phase === 'breathPlanet' || phase === 'breathClose' || phase === 'breathToFlight') {
        return 5;
      }
      return 4;
    }
    if (phase === 'toSound') return '5→6';
    if (phase === 'finale') return 6;
    if (phase === 'ambience') return 7;
    if (phase === 'rotate' || phase === 'obsolete') return 8;
    return 9;
  })();

  return (
    <>
      <a href="#scene-1" className="skip-link">В начало</a>
      <header className="site-header" data-node-id="102:14262">
        <div className="header-left">
          {design.logo && (
            <a className="brand-link" href="#scene-1" aria-label={design.logo.alt}>
              <img className="brand" src={design.logo.src} alt="" width={48} height={48} />
            </a>
          )}
          {design.menu.some(item => item.primary) && (
            <a
              className="nav-pill nav-pill--menu"
              href={design.menu.find(item => item.primary)!.href}
            >
              <img src={asset('assets/icons/menu.svg')} alt="" width={24} height={24} />
              <span>{design.menu.find(item => item.primary)!.label}</span>
            </a>
          )}
          {design.menu.filter(item => !item.primary).length > 0 && (
            <nav className="nav-group" aria-label="Основное меню">
              {design.menu.filter(item => !item.primary).map(item => (
                <a
                  className={`nav-pill${item.active ? ' is-active' : ''}`}
                  href={item.href}
                  key={item.label}
                >
                  {item.label}
                </a>
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

        <section
          id="scene-2"
          className="cards-section"
          aria-label="Экран 2"
          data-node-id="102:14308"
        >
          {design.cardsTitle && <h2 className="cards-title">{design.cardsTitle}</h2>}
          <div className="cards-scroller" tabIndex={0} aria-label="Карточки возможностей">
            <div className="cards-track" ref={cardsTrack}>
              {design.cards.map((card, i) => (
                <div
                  className="card"
                  key={i}
                  role="img"
                  aria-label={card.alt}
                  style={{ aspectRatio: card.aspectRatio }}
                >
                  <img
                    src={card.src}
                    alt={card.alt}
                    loading="lazy"
                    width={card.width}
                    height={700}
                    style={{ aspectRatio: card.aspectRatio }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="scene-3"
          className="reveal-section"
          aria-label="Экран 3"
          data-node-id="102:14655"
        >
          {design.revealTitle && (
            <h1 className="reveal-title" data-node-id="102:14656">
              {design.revealTitle}
            </h1>
          )}
        </section>

        <section
          className="experience"
          ref={stage}
          style={{ '--story-distance': totalDistance } as CSSProperties}
          aria-label="Экраны 4–8"
          data-node-id="102:14657"
        >
          {anchors.map(a => (
            <div
              className="scene-anchor"
              id={`scene-${a.id}`}
              key={a.id}
              style={{ top: `${phaseOffset(a.phase) / (totalDistance + 1) * 100}%` }}
            />
          ))}
          <div
            className="scene-anchor"
            id="scene-10"
            style={{ top: `${phaseOffset('obsolete') / (totalDistance + 1) * 100}%` }}
          />
          <div
            className="stage-sticky"
            data-phase={phase}
            data-progress={progress.toFixed(3)}
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
                  />
                </div>
              </div>
            </div>

            {/* STV-75: typography overlays only — video is the sole visual */}
            <div
              className="breath-overlays"
              data-scrub-t={scrubT >= 0 ? scrubT.toFixed(3) : undefined}
              inert={!(rgbOp > 0.01 || rgbBodyOp > 0.01 || dlgOp > 0.01) || undefined}
            >
              {rgbOp > 0.01 && (
                <img
                  className="breath-rgb-title"
                  src={config.captions.rgbTitle}
                  alt={copy.rgbTitle}
                  style={{ opacity: rgbOp }}
                  data-node-id="2653:1839"
                />
              )}

              {rgbBodyOp > 0.01 && (
                <p
                  className="breath-rgb-body"
                  style={{ opacity: rgbBodyOp }}
                  data-node-id="2653:1855"
                >
                  {copy.rgbBody}
                </p>
              )}

              {dlgOp > 0.01 && (
                <div
                  className="breath-dlg"
                  style={{ opacity: dlgOp }}
                  data-node-id="2653:1945"
                >
                  <img
                    src={config.captions.dlgIcon}
                    alt=""
                    width={56}
                    height={56}
                    data-node-id="2653:1947"
                  />
                  <div className="breath-dlg__copy">
                    <h2 data-node-id="2653:1954">{copy.dlgTitle}</h2>
                    <p data-node-id="2653:1955">{copy.dlgBody}</p>
                  </div>
                </div>
              )}
            </div>

            {design.finale && (
              <div
                className={`finale-copy${finaleOpacity > 0.2 ? ' is-in' : ''}`}
                style={{ opacity: finaleOpacity }}
                inert={phase !== 'finale' || undefined}
                data-node-id="102:14789"
              >
                <p className="finale-eyebrow">{design.finale.eyebrow}</p>
                <h2>{design.finale.title}</h2>
                <p>{design.finale.body}</p>
              </div>
            )}

            <div
              className={`ambience-copy${ambienceCopyIn ? ' is-in' : ''}`}
              data-node-id="102:14796"
              style={{ opacity: ambienceCopyOpacity }}
              inert={!ambienceCopyIn || undefined}
            >
              <h2>{design.ambience?.title ?? 'Атмосферная\nподсветка'}</h2>
              <p>
                {design.ambience?.body
                  ?? 'Создает ощущение настоящего кинотеатра\nу вас в доме'}
              </p>
            </div>

            <div
              className={`obsolete-copy${obsoleteTitleOpacity > 0.2 ? ' is-in' : ''}`}
              data-node-id="102:14801"
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
                {design.neverObsolete?.body
                  ?? 'Платформа постоянно обновляется, а технологии будут актуальны ещё долго'}
              </p>
            </div>

            {design.neverObsolete && design.neverObsolete.utps.length > 0 && (
              <div
                className={`obsolete-utps${obsoleteUtpOpacity > 0.35 ? ' is-in' : ''}`}
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

        <Continuation />
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

      <span className="sr-only" aria-live="polite">
        {inView && `Сцена ${sceneLabel}`}
      </span>
      <div
        className="timeline-status"
        hidden
        data-distance={clamp(distance, -1, totalDistance)}
        data-phase={phase}
        data-progress={progress.toFixed(3)}
      />
    </>
  );
}
