/* ------------------------------------------------------------
   Пригласительное: Артём и Ника
   1. Сцена с конвертом: секвенция кадров, перематывается прокруткой
   2. Скретч-карта с датой
   3. Обратный отсчёт
   4. Появление секций
   5. Фоновая музыка
   6. Анкета (демо, ничего не отправляет)
   ------------------------------------------------------------ */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /* ---------- 1. Конверт ---------- */

  // Все числа сцены в одном месте (см. СПЕКА.md §3)
  const SEQ = {
    frames: 41,               // столько файлов лежит в assets/seq
    scrollVh: 280,            // сколько прокрутки занимает сцена
    idleMs: 3000,             // через сколько конверт открывается сам
    openEnd: 0.62,            // на этом прогрессе секвенция доиграла
    eagerCount: 8,            // сколько кадров грузим до первой отрисовки
  };
  const frameUrl = (i) => 'assets/seq/e_' + String(i + 1).padStart(3, '0') + '.jpg';

  const env = document.getElementById('env');
  const frameEl = document.getElementById('envFrame');

  const preloaded = new Array(SEQ.frames);
  let shownIdx = 0;

  function preload(from, to) {
    for (let i = from; i < to && i < SEQ.frames; i++) {
      if (preloaded[i]) continue;
      const im = new Image();
      im.src = frameUrl(i);
      preloaded[i] = im;
    }
  }
  preload(0, SEQ.eagerCount);
  window.addEventListener('load', () => preload(SEQ.eagerCount, SEQ.frames));

  // Показываем запрошенный кадр, если он уже загружен.
  // Иначе откатываемся к ближайшему готовому, чтобы не мигать пустотой.
  function setFrame(target) {
    if (target === shownIdx) return;
    let i = target;
    while (i >= 0 && !(preloaded[i] && preloaded[i].complete)) i--;
    if (i < 0 || i === shownIdx) return;
    frameEl.src = preloaded[i].src;
    shownIdx = i;
  }

  function render(p) {
    const seqP = clamp01(p / SEQ.openEnd);
    setFrame(Math.round(seqP * (SEQ.frames - 1)));
    const cardP = clamp01((p - SEQ.openEnd) / (1 - SEQ.openEnd));
    env.style.setProperty('--card-p', cardP.toFixed(4));
    env.classList.toggle('is-started', p > 0.02);
  }

  if (reduceMotion) {
    render(1);
  } else {
    env.style.height = SEQ.scrollVh + 'vh';

    let rafId = 0;
    const update = () => {
      rafId = 0;
      const range = env.offsetHeight - window.innerHeight;
      const p = range > 0 ? clamp01((window.scrollY - env.offsetTop) / range) : 1;
      render(p);
    };
    const schedule = () => { if (!rafId) rafId = requestAnimationFrame(update); };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();

    // Страховка: гость не понял жест за 3 секунды, открываем сами.
    // Прокрутка остаётся источником правды: мы просто прокручиваем страницу.
    const userEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const idleTimer = setTimeout(() => {
      if (window.scrollY < 4) {
        window.scrollTo({ top: env.offsetHeight - window.innerHeight, behavior: 'smooth' });
      }
    }, SEQ.idleMs);
    const cancelIdle = () => {
      clearTimeout(idleTimer);
      userEvents.forEach((e) => window.removeEventListener(e, cancelIdle));
    };
    userEvents.forEach((e) => window.addEventListener(e, cancelIdle, { passive: true }));
  }

  /* ---------- 2. Скретч-карта с датой ---------- */

  const SCRATCH = {
    brush: 26,          // радиус кисти в CSS-пикселях
    revealAt: 0.45,     // доля стёртого, после которой открываем всё
    autoRevealMs: 9000, // столько ждём, пока гость догадается
  };

  (function initScratch() {
    const section = document.getElementById('date');
    const hint = document.getElementById('dateHint');
    const skip = document.getElementById('dateSkip');
    const foils = Array.prototype.slice.call(section.querySelectorAll('.date__foil'));
    if (!foils.length) return;

    let revealed = false;
    let autoTimer = 0;

    function paint(cv) {
      const rect = cv.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(rect.width * dpr);
      cv.height = Math.round(rect.height * dpr);
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, rect.width, rect.height);
      g.addColorStop(0, '#E9E2D2');
      g.addColorStop(0.5, '#F1EBE0');
      g.addColorStop(1, '#DED5C1');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.lineWidth = SCRATCH.brush * 2;
      cv._ctx = ctx;
    }

    function clearedFraction() {
      let clear = 0;
      let total = 0;
      foils.forEach((cv) => {
        if (!cv._ctx || !cv.width) return;
        const data = cv._ctx.getImageData(0, 0, cv.width, cv.height).data;
        for (let i = 3; i < data.length; i += 4 * 16) {
          total++;
          if (data[i] < 40) clear++;
        }
      });
      return total ? clear / total : 0;
    }

    function reveal() {
      if (revealed) return;
      revealed = true;
      clearTimeout(autoTimer);
      foils.forEach((cv) => cv.classList.add('is-gone'));
      section.classList.add('is-done');
      hint.textContent = '13 июня 2027';
    }

    function pointAt(cv, ev) {
      const r = cv.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    foils.forEach((cv) => {
      paint(cv);
      let drawing = false;
      let last = null;
      let moves = 0;

      cv.addEventListener('pointerdown', (ev) => {
        if (revealed || !cv._ctx) return;
        drawing = true;
        last = pointAt(cv, ev);
        try { cv.setPointerCapture(ev.pointerId); } catch (err) { /* указатель мог уже уйти */ }
        cv._ctx.beginPath();
        cv._ctx.arc(last.x, last.y, SCRATCH.brush, 0, Math.PI * 2);
        cv._ctx.fill();
      });

      cv.addEventListener('pointermove', (ev) => {
        if (!drawing || revealed) return;
        const p = pointAt(cv, ev);
        cv._ctx.beginPath();
        cv._ctx.moveTo(last.x, last.y);
        cv._ctx.lineTo(p.x, p.y);
        cv._ctx.stroke();
        last = p;
        if (++moves % 10 === 0 && clearedFraction() > SCRATCH.revealAt) reveal();
      });

      const stop = (ev) => {
        if (!drawing) return;
        drawing = false;
        if (cv.hasPointerCapture && cv.hasPointerCapture(ev.pointerId)) {
          cv.releasePointerCapture(ev.pointerId);
        }
        if (!revealed && clearedFraction() > SCRATCH.revealAt) reveal();
      };
      cv.addEventListener('pointerup', stop);
      cv.addEventListener('pointercancel', stop);
    });

    skip.addEventListener('click', reveal);

    // Перерисовываем нестёртые плашки при смене размера окна
    window.addEventListener('resize', () => {
      if (revealed) return;
      foils.forEach(paint);
    });

    if (reduceMotion) {
      reveal();
    } else if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !revealed && !autoTimer) {
            autoTimer = setTimeout(reveal, SCRATCH.autoRevealMs);
          }
        });
      }, { threshold: 0.5 });
      io.observe(section);
    }
  })();

  /* ---------- 3. Обратный отсчёт ---------- */

  const WEDDING = new Date('2027-06-13T15:00:00+04:00');   // Ижевск, UTC+4
  const cd = document.getElementById('countdown');
  const cells = {};
  cd.querySelectorAll('[data-cd]').forEach((el) => { cells[el.dataset.cd] = el; });
  const pad = (n, w = 2) => String(n).padStart(w, '0');

  function tick() {
    const diff = WEDDING.getTime() - Date.now();
    if (diff <= 0) {
      cd.classList.add('countdown--today');
      cells.d.textContent = 'Сегодня';
      cells.h.textContent = cells.m.textContent = cells.s.textContent = '';
      return;
    }
    const s = Math.floor(diff / 1000);
    cells.d.textContent = pad(Math.floor(s / 86400), 3);
    cells.h.textContent = pad(Math.floor((s % 86400) / 3600));
    cells.m.textContent = pad(Math.floor((s % 3600) / 60));
    cells.s.textContent = pad(s % 60);
    setTimeout(tick, 1000 - (Date.now() % 1000));
  }
  tick();

  /* ---------- 4. Появление секций ---------- */

  const revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- 5. Музыка ---------- */

  (function initMusic() {
    const audio = document.getElementById('musicAudio');
    const btn = document.getElementById('musicBtn');
    const TARGET = 0.32;      // фон, а не концерт
    let fadeTimer = 0;

    function fade(to, done) {
      clearInterval(fadeTimer);
      const step = (to - audio.volume) / 12;
      fadeTimer = setInterval(() => {
        const next = audio.volume + step;
        if ((step > 0 && next >= to) || (step < 0 && next <= to) || step === 0) {
          audio.volume = to;
          clearInterval(fadeTimer);
          if (done) done();
        } else {
          audio.volume = next;
        }
      }, 40);
    }

    function setState(on) {
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить музыку');
    }

    btn.addEventListener('click', () => {
      if (audio.paused) {
        audio.volume = 0;
        const started = audio.play();
        // play() возвращает промис не во всех браузерах
        Promise.resolve(started).then(() => {
          setState(true);
          fade(TARGET);
        }).catch(() => {
          btn.setAttribute('aria-label', 'Музыку включить не удалось');
        });
      } else {
        setState(false);
        fade(0, () => audio.pause());
      }
    });

    // Не играем в фоновой вкладке
    let pausedByHide = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !audio.paused) {
        audio.pause();
        pausedByHide = true;
      } else if (!document.hidden && pausedByHide) {
        pausedByHide = false;
        audio.play().catch(() => setState(false));
      }
    });
  })();

  /* ---------- 6. Анкета ---------- */

  const form = document.getElementById('rsvpForm');
  const done = document.getElementById('rsvpDone');
  const plusone = document.getElementById('plusone');
  const plusoneWrap = document.getElementById('plusoneWrap');

  plusone.addEventListener('change', () => { plusoneWrap.hidden = !plusone.checked; });

  function setError(fieldEl, errorEl, show) {
    fieldEl.classList.toggle('is-invalid', show);
    errorEl.hidden = !show;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const nameInput = form.elements.name;
    const nameOk = nameInput.value.trim().length > 1;
    setError(nameInput.closest('.field'), document.getElementById('name-error'), !nameOk);

    const attendOk = Boolean(form.querySelector('input[name="attend"]:checked'));
    setError(form.querySelector('input[name="attend"]').closest('.field'), document.getElementById('attend-error'), !attendOk);

    if (!nameOk) { nameInput.focus(); return; }
    if (!attendOk) { form.querySelector('input[name="attend"]').focus(); return; }

    // Демо: имитируем отправку, но честно говорим, что ответ никуда не ушёл
    const btn = form.querySelector('.btn--submit');
    btn.disabled = true;
    btn.textContent = 'Отправляем';
    setTimeout(() => {
      form.hidden = true;
      done.hidden = false;
      done.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }, 900);
  });
})();
