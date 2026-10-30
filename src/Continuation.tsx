import { useEffect, useRef, useState } from 'react';
import { asset } from './base';
import styles from './Continuation.module.css';

const INTERNET_STATES = [
  asset('assets/continuation/internet/state-1.png'), // 132:29082
  asset('assets/continuation/internet/state-2.png'), // 132:28496
  asset('assets/continuation/internet/state-3.png'), // 132:30051
  asset('assets/continuation/internet/state-4.png'), // 132:29379
] as const;

const REMOTE_FEATURES = [
  {
    icon: asset('assets/continuation/remote/feat-1.svg'),
    title: 'Свайпайте\nконтент',
    body: 'Тачпад, как\nна телефоне\nУдобно смотреть контент',
  },
  {
    icon: asset('assets/continuation/remote/feat-2.svg'),
    title: 'Блокировка\nкнопок',
    body: 'На случай, когда пульт попадёт в руки к самым маленьким',
  },
  {
    icon: asset('assets/continuation/remote/feat-3.svg'),
    title: 'Зарядка\nчерез Type-C',
    body: 'Отслуживший аккумулятор можно заменить на новый',
  },
] as const;

const AI_CHIPS = [
  'Ловит на лету',
  'Подсказывает и угадывает',
  'Общается как с человеком',
] as const;

function useInViewPlay(active: boolean) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          const p = el.play();
          if (p) p.catch(() => { /* autoplay policy */ });
        } else {
          el.pause();
        }
      },
      { threshold: [0, 0.25, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active]);
  return ref;
}

function InternetCycle() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    INTERNET_STATES.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.2),
      { threshold: [0, 0.2, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      setIndex(i => (i + 1) % INTERNET_STATES.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [visible]);

  return (
    <div className={styles.internet} data-node-id="132:17369" ref={rootRef}>
      <div className={styles.internetFrame}>
        {INTERNET_STATES.map((src, i) => (
          <img
            key={src}
            className={`${styles.internetImg}${i === index ? ` ${styles.internetImgActive}` : ''}`}
            src={src}
            alt=""
            width={1372}
            height={800}
            decoding="async"
          />
        ))}
        <div className={styles.internetCopy}>
          <h2 className={styles.internetTitle}>Нужен только интернет</h2>
          <p className={styles.internetBody}>
            В вашем распоряжении привычные телеканалы, онлайн-кинотеатры, облачный
            гейминг и многое другое. Антенна не понадобится
          </p>
        </div>
      </div>
    </div>
  );
}

function RemoteBlock() {
  const videoRef = useInViewPlay(true);
  return (
    <section className={`${styles.block} ${styles.remote}`} data-node-id="132:16570" aria-label="Продвинутый пульт">
      <div className={styles.remoteShell}>
        <video
          ref={videoRef}
          className={styles.remoteVideo}
          src={asset('media/continuation/remote.mp4')}
          muted
          playsInline
          loop
          preload="auto"
          data-node-id="132:20755"
        />
        <h2 className={styles.remoteTitle}>Продвинутый пульт</h2>
        <div className={styles.remoteFeatures}>
          {REMOTE_FEATURES.map(f => (
            <article className={styles.remoteFeat} key={f.title}>
              <img className={styles.remoteFeatIcon} src={f.icon} alt="" width={64} height={64} />
              <h3 className={styles.remoteFeatTitle}>{f.title}</h3>
              <p className={styles.remoteFeatBody}>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BracketBlock() {
  const videoRef = useInViewPlay(true);
  return (
    <section className={styles.bracket} data-node-id="132:16727" aria-label="Кронштейн и баланс">
      <div className={styles.bracketLeft}>
        <video
          ref={videoRef}
          className={styles.bracketVideo}
          src={asset('media/continuation/bracket.mp4')}
          muted
          playsInline
          loop
          preload="auto"
          data-node-id="132:20799"
        />
        <h3 className={`${styles.bracketH} ${styles.bracketMountTitle}`}>Кронштейн</h3>
        <p className={`${styles.bracketP} ${styles.bracketMountBody}`}>
          Можно закрепить практически вплотную к стене
        </p>
        <h3 className={`${styles.bracketH} ${styles.bracketTouchTitle}`}>Приятно прикасаться</h3>
        <p className={`${styles.bracketP} ${styles.bracketTouchBody}`}>
          Лёгкий металлический корпус и минимум кнопок
        </p>
      </div>
      <div className={styles.bracketRight}>
        <img
          className={styles.bracketRightImg}
          src={asset('assets/continuation/bracket/right.png')}
          alt=""
          width={718}
          height={879}
          decoding="async"
        />
      </div>
    </section>
  );
}

export function Continuation() {
  return (
    <div className={styles.root} data-node-id="132:15927" data-testid="figma-continuation">
      <RemoteBlock />

      <section
        className={`${styles.copyBlock} ${styles.copyBlockTall}`}
        data-node-id="132:16706"
        aria-label="Понимает с полуслова"
      >
        <h2 className={styles.copyTitle}>{'Понимает\nс полуслова.\nНадёжный. Свой'}</h2>
        <p className={styles.copyBody}>
          ИИ-помощник находит нужный контент, отвечает голосом и управляет умным домом
        </p>
      </section>

      <section className={styles.plate} data-node-id="132:16709" aria-label="ИИ-помощник">
        <img
          className={styles.plateMedia}
          src={asset('assets/continuation/ai/scene.png')}
          alt=""
          width={1440}
          height={801}
          decoding="async"
        />
        <div className={styles.aiChips}>
          {AI_CHIPS.map(label => (
            <p className={styles.aiChip} key={label}>{label}</p>
          ))}
        </div>
      </section>

      <section className={styles.plate} data-node-id="132:16710" aria-label="Экран, который впишется">
        <img
          className={styles.plateMedia}
          src={asset('assets/continuation/screen/section.png')}
          alt=""
          width={1440}
          height={1163}
          decoding="async"
        />
        <h2 className={styles.screenTitle}>Экран, который впишется</h2>
        <div className={styles.screenStats}>
          <div>
            <p className={styles.screenStatValue}>53.7 мм</p>
            <p className={styles.screenStatLabel}>Тонкий корпус</p>
          </div>
          <div>
            <p className={styles.screenStatValue}>49 мм</p>
            <p className={styles.screenStatLabel}>Расстояние до стены благодаря кронштейну</p>
          </div>
        </div>
      </section>

      <BracketBlock />

      <section className={styles.plate} data-node-id="132:16865" aria-label="Четыре диагонали">
        <img
          className={styles.plateMedia}
          src={asset('assets/continuation/diagonals/section.png')}
          alt=""
          width={1440}
          height={872}
          decoding="async"
        />
        <p className={styles.diagSizes}>55” 65” 75” 85”</p>
        <h2 className={styles.diagTitle}>{'Четыре диагонали\nна выбор'}</h2>
      </section>

      <section
        className={`${styles.copyBlock} ${styles.copyBlockTall}`}
        data-node-id="132:16873"
        aria-label="Больше возможностей"
      >
        <h2 className={styles.copyTitle}>{'Больше возможностей\nс телевизором Сбер'}</h2>
      </section>

      <section className={styles.plate} data-node-id="132:16875" aria-label="Дом, умный дом">
        <img
          className={styles.plateMedia}
          src={asset('assets/continuation/smarthome/section.png')}
          alt=""
          width={1440}
          height={845}
          decoding="async"
        />
        <h2 className={styles.smartTitle}>{'Дом, умный\nдом'}</h2>
        <p className={styles.smartBody}>
          {'Встроенный умный хаб\nс протоколом Zigbee.\nСоздавайте и запускайте сценарии автоматизации'}
        </p>
      </section>

      <section className={styles.plate} data-node-id="132:16885" aria-label="Три колонки">
        <img
          className={styles.plateMedia}
          src={asset('assets/continuation/columns/section.png')}
          alt=""
          width={1440}
          height={800}
          decoding="async"
        />
      </section>

      <InternetCycle />

      <section className={styles.tech} data-node-id="132:17370" aria-label="Технологии">
        <h2 className={styles.techTitle}>Технологии кинотеатра Сбер 9000</h2>
        <div className={styles.techRow}>
          <span className={styles.techRowLabel}>Четыре диагонали</span>
          <span className={styles.techRowValue}>55” 65” 75” 85”</span>
        </div>
        <div className={styles.techSpecs}>
          <div className={styles.techSpecCol}>
            <div className={styles.techSpecLine}>
              <span className={styles.techRowLabel}>Процессор</span>
              <span className={styles.techRowValue}>мощность 1.9 Гц</span>
            </div>
            <div className={styles.techSpecLine}>
              <span className={styles.techRowLabel}>Bluetooth</span>
              <span className={styles.techRowValue}>5.1</span>
            </div>
          </div>
          <div className={styles.techSpecCol}>
            <div className={styles.techSpecLine}>
              <span className={styles.techRowLabel}>Технологии</span>
              <span className={styles.techRowValue}>
                управление голосом
                <br />
                no screen режим
                <br />
                (работает как умная колонка)
              </span>
            </div>
          </div>
        </div>
        <div className={styles.techGrid}>
          <div>
            <p className={styles.techCellLabel}>Высокое разрешение</p>
            <p className={styles.techCellMeta}>3840 х 2160</p>
            <p className={styles.techCellValue}>UHD</p>
          </div>
          <div>
            <p className={styles.techCellLabel}>Чтобы объединять домашние устройства в систему</p>
            <p className={styles.techCellMeta}>умный дом</p>
            <p className={styles.techCellValue}>Zigbee-хаб</p>
          </div>
          <div>
            <p className={styles.techCellLabel}>Прокачанный отклик</p>
            <p className={styles.techCellMeta}>нативно: 144 Гц</p>
            <p className={styles.techCellValue}>{'DLG:\n288 Гц'}</p>
          </div>
          <div>
            <p className={styles.techCellLabel}>Много памяти — много приложений</p>
            <p className={styles.techCellMeta}>встроенная память</p>
            <p className={styles.techCellValue}>64 ГБ</p>
          </div>
        </div>
        <div className={styles.techSide}>
          <div>
            <p className={styles.techCellLabel}>Технология экрана, которой можно гордиться</p>
            <p className={styles.techCellValue}>{'RGB\nminiLED'}</p>
          </div>
        </div>
      </section>

      <section className={styles.finale} data-node-id="132:17415" aria-label="Финальная композиция">
        <img
          className={styles.finaleImg}
          src={asset('assets/continuation/finale/tv.png')}
          alt=""
          width={1362}
          height={760}
          decoding="async"
        />
        <p className={styles.finaleLeft}>Первый кинотеатр</p>
        <p className={styles.finaleRight}>{'с интеллектом\nСбер'}</p>
      </section>

      <footer className={styles.footer} data-node-id="132:17419">
        <div className={styles.footerGrid}>
          <div className={styles.footerCols}>
            <div>
              <p className={styles.footerColTitle}>Пользователям</p>
              <ul className={styles.footerList}>
                {[
                  'Акции',
                  'Оплата и доставка',
                  'Поддержка',
                  'Гарантия и ремонт',
                  'Возврат',
                  'Для бизнеса',
                  'О компании',
                  'Контакты',
                ].map(label => (
                  <li key={label}><span>{label}</span></li>
                ))}
                <li><span className={styles.footerMore}>Показать ещё</span></li>
              </ul>
            </div>
            <div>
              <p className={styles.footerColTitle}>Продукты</p>
              <ul className={styles.footerList}>
                {[
                  'SberBoom',
                  'SberBoom Mini',
                  'Телевизоры Sber',
                  'SberBox',
                  'Умный дом',
                  'SberPortal',
                  'SberBox Top',
                  'SberBox Time',
                ].map(label => (
                  <li key={label}><span>{label}</span></li>
                ))}
                <li><span className={styles.footerMore}>Показать ещё</span></li>
              </ul>
            </div>
          </div>
          <div>
            <img
              className={styles.footerBrand}
              src={asset('assets/continuation/footer/logo.svg')}
              alt="SberDevices"
              width={370}
              height={48}
            />
            <div className={styles.footerMeta}>
              <div>
                <p className={styles.footerMetaValue}>
                  {'Москва, вн.тер.г. Муниципальный округ Очаково-Матвеевское,\nш. Очаковское, д. 28, стр. 2, помещ. 8H/3'}
                </p>
                <p className={styles.footerMetaLabel}>Адрес</p>
              </div>
              <div>
                <p className={styles.footerMetaValue}>900</p>
                <p className={styles.footerMetaLabel}>Бесплатно с мобильного на территории РФ</p>
              </div>
              <div>
                <p className={styles.footerMetaValue}>+7 (495) 500-55-50</p>
              </div>
            </div>
            <div className={styles.footerSocial}>
              <a href="#social-vk" aria-label="VK">
                <img src={asset('assets/continuation/footer/social-1.png')} alt="" width={48} height={48} />
              </a>
              <a href="#social-ok" aria-label="OK">
                <img src={asset('assets/continuation/footer/social-2.png')} alt="" width={48} height={48} />
              </a>
              <a href="#social-tg" aria-label="Telegram">
                <img src={asset('assets/continuation/footer/social-3.png')} alt="" width={48} height={48} />
              </a>
            </div>
          </div>
        </div>
        <div className={styles.footerLegal}>
          <span>© 2025 SberDevices</span>
          <span>Условия продаж</span>
          <span>Политика конфиденциальности</span>
          <span>Правила гарантийного обслуживания</span>
        </div>
      </footer>
    </div>
  );
}
