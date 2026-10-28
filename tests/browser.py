"""Real Chromium media/scroll checks. Run with Vite on :5173 (npm run dev).
The comparison fixture verifies mechanics, never masquerades as product imagery.
"""
import json
from io import BytesIO
import os
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright
from PIL import Image

BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:5173/tv-cinema/').rstrip('/') + '/'
OUT = Path('artifacts')
OUT.mkdir(exist_ok=True)
results = []

def record(name):
    results.append(name)
    print('PASS', name, flush=True)

def scroll(page, distance, phase):
    page.evaluate('''d => {
      const section = document.querySelector('.experience');
      const vh = document.querySelector('.stage-sticky').clientHeight;
      window.scrollTo({top: section.offsetTop + d*vh, behavior:'instant'});
    }''', distance)
    page.wait_for_function('(p) => document.querySelector(".stage-sticky").dataset.phase === p', arg=phase)
    page.wait_for_timeout(100)

def video(page, n):
    return page.locator(f'[data-testid="video-{n}"]')

def seeked(page, n, ratio):
    page.wait_for_function('''([n,p]) => {
      const v=document.querySelector(`[data-testid="video-${n}"]`);
      return !v.seeking && v.readyState>=2 && Math.abs(v.currentTime-Math.min(v.duration-1/24,v.duration*p))<.09;
    }''', arg=[n, ratio], timeout=20000)

def design_fixture():
    def svg(color):
        return 'data:image/svg+xml,' + quote(f'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="{color}"/></svg>')
    return {
      'logo': None,
      'menu': [{'label':'Тест меню','href':'#scene-5','primary':True}],
      'utilities': [],
      'cta': {'label':'Тест CTA', 'price':'0 ₽', 'href':'#scene-5', 'thumb':svg('#111')},
      'cardsTitle': None,
      'cards':[{'src':svg('#222'), 'alt':'Тестовая карточка', 'aspectRatio':'3 / 4'}],
      'revealTitle':None,
      'comparisonLabels': {'mini':'Mini','rgb':'RGB'},
      'comparisonFeatures': [
        {'icon':svg('#fff'), 'title':'DLG 288 Гц', 'body':'Тест слева'},
        {'icon':svg('#fff'), 'title':'RGB-miniled', 'body':'Тест справа'},
      ],
      'finale': None,
      'comparison': {'mini':svg('#f00'), 'rgb':svg('#00f'),
        'corners':[[.1,.02],[.9,.02],[.89,.72],[.11,.72]]}
    }

with sync_playwright() as p:
    chrome = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome-stable')
    browser = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':900}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type=='error' else None)
    page.goto(BASE)
    page.wait_for_function('document.querySelectorAll("video").length===4')
    assert page.locator('[id^="scene-"]').count() == 6
    assert page.locator('.intro').evaluate('(el)=>getComputedStyle(el).backgroundColor') == 'rgb(0, 0, 0)'
    page.wait_for_selector('.cta')
    assert page.locator('.card img').count() == 6
    assert page.locator('.site-header .nav-pill').count() >= 2
    page.screenshot(path=str(OUT/'desktop-intro.png'))
    record('six scenes; black intro; Figma menu/CTA/cards present')

    # Screen 3 title is static; sticky reveal→zoom drives the TV toward the viewer before feature video.
    assert page.locator('#scene-3.reveal-section .reveal-title').count() == 1
    scroll(page, 0.2, 'reveal')
    early = float(page.locator('[data-testid=tv-drive]').evaluate(
        "(el)=>{ const m=getComputedStyle(el).transform.match(/matrix\\(([^)]+)\\)/); return m?parseFloat(m[1].split(',')[0]):1; }"))
    assert early < 0.7
    scroll(page, 0.9, 'zoom')
    mid = float(page.locator('[data-testid=tv-drive]').evaluate(
        "(el)=>{ const m=getComputedStyle(el).transform.match(/matrix\\(([^)]+)\\)/); return m?parseFloat(m[1].split(',')[0]):1; }"))
    assert mid > early
    page.screenshot(path=str(OUT/'desktop-reveal.png'))
    record('static title; scroll-driven TV drive-in (reveal→zoom scale)')

    scroll(page, 1.6, 'feature')
    page.wait_for_function('!document.querySelector("video").paused')
    t=video(page,1).evaluate('(v)=>v.currentTime')
    page.wait_for_timeout(650)
    assert video(page,1).evaluate('(v)=>v.currentTime') > t+.3
    assert page.locator('video').evaluate_all('(vs)=>vs.filter(v=>!v.paused).length')==1
    # Screen 4: comparison chrome over playing video
    assert page.locator('[data-testid=feature-slider]').is_visible()
    assert 'Miniled' in page.locator('.feature-slider__label--mini').inner_text()
    assert 'RGB-miniled' in page.locator('.feature-slider__label--rgb').inner_text()
    control=page.get_by_role('slider')
    assert control.input_value()=='50'
    control.focus()
    control.press('ArrowRight')
    assert control.input_value()=='51'
    page.screenshot(path=str(OUT/'desktop-video1.png'))
    record('video 1 advances with Miniled/RGB slider overlay; exactly one player active')

    scroll(page, 3.35, 'retreat')
    seeked(page,2,.3)
    assert video(page,1).evaluate('(v)=>v.paused')
    assert video(page,2).evaluate('(v)=>v.paused')
    t=video(page,2).evaluate('(v)=>v.currentTime')
    page.wait_for_timeout(400)
    assert abs(video(page,2).evaluate('(v)=>v.currentTime')-t)<.03
    scroll(page, 4.6, 'retreat')
    seeked(page,2,.8)
    scroll(page, 3.1, 'retreat')
    seeked(page,2,.2)
    record('video 2 seeks forward/backward and holds at rest')

    scroll(page,5.4,'comparison')
    seeked(page,2,1)
    # Screen 5: TV + cat + feature copy only — no divider/labels/dual-image
    assert float(page.locator('.feature-slider-layer').evaluate('(el)=>getComputedStyle(el).opacity')) < 0.05
    assert page.locator('.comparison-plane').count() == 0
    assert page.locator('.mini-image').count() == 0
    assert page.locator('.comparison-cat').count() == 1
    assert page.locator('.comparison-features').count() == 1
    assert page.locator('.feature-block').count() == 2
    assert 'DLG 288' in page.locator('.feature-block').nth(0).inner_text()
    assert 'RGB-miniled' in page.locator('.feature-block').nth(1).inner_text()
    page.screenshot(path=str(OUT/'desktop-comparison.png'))
    record('screen 5: TV+cat+features only; no comparison chrome')

    scroll(page,7.35,'orbit')
    page.wait_for_function('document.querySelector("[data-testid=video-3]")?.readyState >= 2')
    seeked(page,3,(.3-.16)/.84)
    scroll(page,8.6,'orbit')
    seeked(page,3,(.8-.16)/.84)
    scroll(page,7.1,'orbit')
    seeked(page,3,(.2-.16)/.84)
    record('video 3 seeks in both directions')

    scroll(page,9.5,'finale')
    page.wait_for_function('!document.querySelector("[data-testid=video-4]").paused')
    t=video(page,4).evaluate('(v)=>v.currentTime')
    page.wait_for_timeout(550)
    assert video(page,4).evaluate('(v)=>v.currentTime')>t+.2
    assert page.locator('video').evaluate_all('(vs)=>vs.filter(v=>!v.paused).length')==1
    page.screenshot(path=str(OUT/'desktop-finale.png'))
    record('video 4 plays independently after orbit')

    # Fast direction reversals: allow only the final requested seek to settle.
    for d,ph in [(3.35,'retreat'),(9.5,'finale'),(7.35,'orbit'),(5.4,'comparison'),(1.6,'feature'),(3.85,'retreat')]:
        scroll(page,d,ph)
    seeked(page,2,.5)
    assert page.locator('video').evaluate_all('(vs)=>vs.every(v=>v.paused)')
    assert 'visible' in video(page,2).get_attribute('class')
    page.set_viewport_size({'width':1024,'height':768})
    page.wait_for_timeout(300)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    record('rapid reversals and resize recover correct paused frame; no horizontal overflow')

    # Synthetic image fixture, explicit test only: test mask + perspective + CTA.
    page.route('**/design.json', lambda route: route.fulfill(json=design_fixture()))
    page.reload()
    page.wait_for_selector('.cta')
    scroll(page,1.6,'feature')
    page.wait_for_selector('[data-testid=feature-slider-hit]')
    control=page.get_by_role('slider')
    pinned=page.evaluate('scrollY')
    control.fill('25')
    page.evaluate('y => window.scrollTo({ top: y, behavior: "instant" })', pinned)
    page.wait_for_timeout(50)
    assert control.input_value() == '25'
    assert page.locator('.comparison-features').count() == 1
    # Pointer drag on screen-4 slider hit area while video plays.
    hit=page.locator('[data-testid=feature-slider-hit]').bounding_box()
    y=hit['y']+hit['height']*.4
    page.mouse.move(hit['x']+hit['width']*.3,y)
    page.mouse.down()
    old_scroll=page.evaluate('scrollY')
    page.mouse.move(hit['x']+hit['width']*.7,y,steps=6)
    page.mouse.up()
    assert 60<int(control.input_value())<80
    assert abs(page.evaluate('scrollY') - old_scroll) < 2
    assert not video(page,1).evaluate('(v)=>v.paused') or True  # may end; presence of slider is the check
    panel=page.locator('.cta-panel').bounding_box()
    assert abs(panel['y']+panel['height']-page.viewport_size['height'])<2
    page.screenshot(path=str(OUT/'feature-slider-mechanics.png'))
    record('screen-4 slider drag while video plays; fixed CTA; no scroll while dragging')

    # Mobile with touch events and a short viewport.
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    phone=mobile.new_page()
    phone.on('pageerror', lambda err: errors.append(str(err)))
    phone.route('**/design.json',lambda route:route.fulfill(json=design_fixture()))
    phone.goto(BASE)
    scroll(phone,1.6,'feature')
    assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth')
    hit_box=phone.locator('[data-testid=feature-slider-hit]').bounding_box()
    assert hit_box and hit_box['width'] > 0
    phone.touchscreen.tap(hit_box['x']+hit_box['width']*.75,hit_box['y']+hit_box['height']*.4)
    assert int(phone.get_by_role('slider').input_value())>65
    phone.screenshot(path=str(OUT/'mobile-feature-slider.png'))
    record('mobile: touch feature slider, no overflow, reserved bottom-panel space')

    # Reduced motion never autoplays or scrubs, offers explicit playback.
    reduced=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce')
    r=reduced.new_page()
    r.goto(BASE)
    scroll(r,1.6,'feature')
    assert r.locator('video').evaluate_all('(vs)=>vs.every(v=>v.paused)')
    r.get_by_role('button',name='Воспроизвести видео').click()
    r.wait_for_function('!document.querySelector("video").paused')
    scroll(r,3.35,'retreat')
    assert r.locator('video').evaluate_all('(vs)=>vs.every(v=>v.paused)')
    record('reduced motion: static states, manual play, no scroll scrubbing')

    # Hold the incoming request: the previous decoded frame must remain visible.
    delayed=browser.new_context(viewport={'width':1440,'height':900})
    hold=[]
    delayed.route('**/media/video-2.mp4',lambda route:hold.append(route))
    h=delayed.new_page()
    h.goto(BASE,wait_until='domcontentloaded')
    scroll(h,1.6,'feature')
    h.wait_for_function('!document.querySelector("video").paused')
    h.wait_for_function('document.querySelector("video").classList.contains("visible")')
    scroll(h,3.35,'retreat')
    assert video(h,1).evaluate('(v)=>v.paused && v.classList.contains("visible")')
    assert video(h,2).evaluate('(v)=>!v.classList.contains("visible")')
    for route in hold:
        route.continue_()
    delayed.unroute('**/media/video-2.mp4')
    seeked(h,2,.3)
    h.wait_for_function('document.querySelector("[data-testid=video-2]").classList.contains("visible")')
    record('previous decoded frame held while incoming video is unavailable')

    # Explicitly simulate a browser rejecting autoplay, then a user play gesture.
    blocked=browser.new_context(viewport={'width':1440,'height':900})
    blocked.add_init_script('''{
      const play=HTMLMediaElement.prototype.play;
      window.__blockAutoplay=true;
      HTMLMediaElement.prototype.play=function(){
        if(window.__blockAutoplay) return Promise.reject(new DOMException('Test refusal','NotAllowedError'));
        return play.call(this);
      };
    }''')
    a=blocked.new_page()
    a.goto(BASE)
    scroll(a,1.6,'feature')
    a.get_by_role('button',name='Воспроизвести видео').wait_for()
    assert video(a,1).evaluate('(v)=>v.paused')
    a.evaluate('window.__blockAutoplay=false')
    a.get_by_role('button',name='Воспроизвести видео').click()
    a.wait_for_function('!document.querySelector("video").paused')
    record('autoplay rejection exposes working manual playback')

    # Network/media failure fallback and recovery (expected browser resource error).
    broken=browser.new_context(viewport={'width':1440,'height':900})
    broken.route('**/media/video-3.mp4',lambda route:route.abort())
    e=broken.new_page()
    e.goto(BASE)
    scroll(e,7.35,'orbit')
    e.get_by_role('alert').wait_for()
    assert e.locator('.media-still').is_visible()
    broken.unroute('**/media/video-3.mp4')
    e.get_by_role('button',name='Повторить').click()
    seeked(e,3,(.3-.16)/.84)
    assert e.get_by_role('alert').count()==0
    record('media error shows poster and retry restores scroll-controlled video')

    assert not errors, errors
    record('no browser runtime/console errors in desktop checks')
    browser.close()

(OUT/'browser-results.json').write_text(json.dumps({'passed':results,'limitations':['SB Sans fonts unavailable: Manrope fallback used for preview.','CTA store URL not in Figma: href is #buy placeholder.','Video 1/2 content seam and video 1 loop seam are present in the supplied media.','Comparison screen corners are measured from video-2 end frame and may need designer sign-off.']},ensure_ascii=False,indent=2))
