/* ─────────────────────────────────
   AGENDA + CUENTA REGRESIVA (hora de Colombia, UTC-5)
   La cuenta regresiva apunta siempre al PRÓXIMO bloque:
   Gala → Conferencias → Mastermind. Para cambiar un horario,
   se cambia aquí y en las tarjetas del inicio (index.html, data-ini).
───────────────────────────────── */
const SESIONES = [
  { n:'Noche de Gala', c:'Mié 28 Oct · 7:30 PM', ini:'2026-10-28T19:30:00-05:00', fin:'2026-10-29T00:30:00-05:00' },
  { n:'Conferencias',  c:'Jue 29 Oct · 8:00 AM', ini:'2026-10-29T08:00:00-05:00', fin:'2026-10-29T19:00:00-05:00' },
  { n:'Mastermind',    c:'Vie 30 Oct · 7:30 AM', ini:'2026-10-30T07:30:00-05:00', fin:'2026-10-30T18:00:00-05:00' }
].map(s => ({ ...s, ini:new Date(s.ini).getTime(), fin:new Date(s.fin).getTime() }));
const ahora = () => (window.__LS_AHORA ? window.__LS_AHORA() : Date.now());   // __LS_AHORA solo para pruebas

function updateCountdown(){
  const now  = ahora();
  const vivo = SESIONES.find(s => now >= s.ini && now < s.fin);
  const prox = SESIONES.find(s => now < s.ini);
  const pad  = n => String(n).padStart(2,'0');
  const diff = prox ? prox.ini - now : 0;
  const d = Math.floor(diff/864e5), h = Math.floor(diff%864e5/36e5), m = Math.floor(diff%36e5/6e4), s = Math.floor(diff%6e4/1e3);
  const vals = prox ? [d,h,m,s].map(pad) : ['00','00','00','00'];
  ['cd-days','cd-hours','cd-mins','cd-secs'].forEach((id,i)=>{ const el=document.getElementById(id); if(el) el.textContent=vals[i]; });
  ['scd-d','scd-h','scd-m','scd-s'].forEach((id,i)=>{ const el=document.getElementById(id); if(el) el.textContent=vals[i]; });
  const ses = document.getElementById('scd-sesion'), bad = document.getElementById('scd-badge');
  if(ses && bad){
    bad.classList.toggle('vivo', !!vivo); bad.classList.toggle('fin', !vivo && !prox);
    if(vivo){ ses.textContent = vivo.n + ' · en vivo ahora' + (prox ? ' · sigue ' + prox.n : ''); bad.textContent = 'EN VIVO'; }
    else if(prox){ ses.textContent = prox.n + ' · ' + prox.c; bad.textContent = 'PRÓXIMO'; }
    else { ses.textContent = 'Labs Summit 2026 · ¡Gracias por venir!'; bad.textContent = 'FINALIZADO'; }
    const bar = document.getElementById('sticky-cd');
    if(bar) bar.setAttribute('aria-label', prox ? 'Cuenta regresiva: ' + prox.n : 'Labs Summit 2026');
  }
  // cuenta regresiva dentro de la tarjeta del día principal (29)
  const hc = document.querySelector('.ha-cuenta');
  if(hc){
    const dp = SESIONES[1], lab = hc.querySelector('.hc-l');
    hc.classList.toggle('vivo', now >= dp.ini);
    if(now < dp.ini){
      const f = dp.ini - now, v = { d:Math.floor(f/864e5), h:Math.floor(f%864e5/36e5), m:Math.floor(f%36e5/6e4), s:Math.floor(f%6e4/1e3) };
      hc.querySelectorAll('b[data-u]').forEach(b => { const x = pad(v[b.dataset.u]); if(b.textContent !== x) b.textContent = x; });
      if(lab.textContent !== 'Empieza en') lab.textContent = 'Empieza en';
    } else {
      const txt = now < dp.fin ? 'En vivo · hasta 7:00 PM' : '¡Gracias por venir!';
      if(lab.textContent !== txt) lab.textContent = txt;
    }
  }
  const sEl = document.getElementById('scd-s');
  if(sEl && prox){ sEl.style.transform='scale(1.2)'; setTimeout(()=>sEl.style.transform='',120); }
}
updateCountdown();
setInterval(updateCountdown, 1000);

/* Tarjetas de la agenda del inicio: «Mañana», «Hoy», «En vivo», «Finalizado» */
(function(){
  const cards = [...document.querySelectorAll('.ha-day[data-ini]')];
  if(!cards.length) return;
  const caja = document.querySelector('.hero-agenda');
  const titulo = document.getElementById('ha-titulo');
  const diaCol = ms => new Date(ms).toLocaleDateString('en-CA', { timeZone:'America/Bogota' });   // AAAA-MM-DD en Colombia
  const diasEntre = (a,b) => Math.round((new Date(diaCol(b)) - new Date(diaCol(a))) / 864e5);
  const relativo = (now, ini) => { const n = diasEntre(now, ini); return n<=0 ? 'Hoy' : n===1 ? 'Mañana' : 'En ' + n + ' días'; };
  const poner = (el, txt) => { if(el.textContent !== txt) el.textContent = txt; };   // solo toca el DOM si cambió
  function pintar(){
    const now = ahora();
    let marcadoProx = false, hayVivo = false;
    cards.forEach((c, i) => {
      const ini = new Date(c.dataset.ini).getTime(), fin = new Date(c.dataset.fin).getTime();
      const est = c.querySelector('.ha-estado');
      c.classList.remove('prox','vivo','fin');
      if(now >= fin){ c.classList.add('fin'); poner(est, 'Finalizado'); }
      else if(now >= ini){ c.classList.add('vivo'); poner(est, 'En vivo'); hayVivo = true; }
      else {
        const rel = relativo(now, ini), falta = ini - now;
        if(!marcadoProx){ marcadoProx = true; c.classList.add('prox'); }
        // etiqueta corta (cabe en celular): «Mañana», «En 2 días», «Hoy · en 3 h», «Hoy · en 25 min»
        if(rel === 'Hoy'){ poner(est, 'Hoy · en ' + (falta >= 36e5 ? Math.round(falta/36e5) + ' h' : Math.max(1, Math.ceil(falta/6e4)) + ' min')); }
        else poner(est, rel);
      }
    });
    if(caja) caja.classList.toggle('en-vivo', hayVivo);
    if(titulo){
      const prox = SESIONES.find(s => now < s.ini), vivo = SESIONES.find(s => now >= s.ini && now < s.fin);
      poner(titulo, vivo ? '¡Estamos en vivo! · ' + vivo.n
        : prox ? 'Tres días · 28, 29 y 30 de octubre'
        : 'Gracias por ser parte de Labs Summit 2026');
    }
  }
  pintar();
  setInterval(pintar, 20000);

  // Celular: mientras «Comprar / Ver mapa» estén a la vista, el botón de WhatsApp no los tapa
  const ctas = document.querySelector('.ha-ctas');
  if(ctas && 'IntersectionObserver' in window){
    new IntersectionObserver(es => document.body.classList.toggle('cta-hero', es[0].isIntersecting), { threshold:.2 }).observe(ctas);
  }

  // Con mouse: la tarjeta se inclina hacia el cursor y una luz lo sigue
  if(matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    cards.forEach(c => {
      let raf = 0, ev = null;
      const mover = () => { raf = 0; const r = c.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        c.style.setProperty('--ry', ((x - .5) * 9).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 7).toFixed(2) + 'deg');
        c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%'); };
      c.addEventListener('pointermove', e => { ev = e; if(!raf) raf = requestAnimationFrame(mover); });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx','0deg'); c.style.setProperty('--ry','0deg'); });
    });
  }
})();

/* ─────────────────────────────────
   SCROLL PROGRESS BAR + NAV
───────────────────────────────── */
const pbar = document.getElementById('pbar');
let _scrollPending = false;
window.addEventListener('scroll',()=>{
  if(_scrollPending) return;
  _scrollPending = true;
  requestAnimationFrame(()=>{
    const pct = (window.scrollY/(document.body.scrollHeight-window.innerHeight))*100;
    pbar.style.width = pct+'%';
    updateJourneyNav();
    _scrollPending = false;
  });
},{passive:true});

/* ─────────────────────────────────
   JOURNEY NAV
───────────────────────────────── */
const jSections = ['hero','days','tickets','speakers','sponsors','videos','galeria','faq'];
const jDots = document.querySelectorAll('.jn-dot');
let _jOffsets = null;
function cacheOffsets(){ _jOffsets = jSections.map(id=>{ const el=document.getElementById(id); return el?el.offsetTop:0; }); }
window.addEventListener('resize',()=>{ _jOffsets=null; },{passive:true});
function updateJourneyNav(){
  if(!_jOffsets) cacheOffsets();
  let current = 'hero';
  jSections.forEach((id,i)=>{
    if(_jOffsets[i] && window.scrollY >= _jOffsets[i] - 200) current = id;
  });
  jDots.forEach(d=>{
    d.classList.toggle('active', d.dataset.section === current);
  });
}
jDots.forEach(dot=>{
  dot.addEventListener('click',()=>{
    const el = document.getElementById(dot.dataset.section);
    if(el) el.scrollIntoView({behavior:'smooth'});
  });
});
function scrollTo(id){
  const el = document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth'});
}

/* ─────────────────────────────────
   REVEAL ON SCROLL
───────────────────────────────── */
const observer = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('vis');
      // Day 3 methods
      if(e.target.id==='panel-3'){
        ['ms1','ms2','ms3'].forEach((id,i)=>{
          setTimeout(()=>{
            const el=document.getElementById(id);
            if(el) el.classList.add('vis');
          },i*180);
        });
      }
    }
  });
}, {threshold:0.12});

document.querySelectorAll('.reveal,.sp-card,.sp-mini,.video-card,.day-panel').forEach(el=>observer.observe(el));


/* ─────────────────────────────────
   DAY TABS
───────────────────────────────── */
function switchDay(n){
  // Selector cards
  document.querySelectorAll('.day-sel-card').forEach((c,i)=>{
    c.classList.toggle('active', i===n-1);
    c.setAttribute('aria-selected', i===n-1);
  });

  // Panels — slide transition
  const panels = document.querySelectorAll('.day-panel');
  panels.forEach((p,i)=>{
    if(i===n-1){
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  // Giant background number
  const bgNum = document.getElementById('days-bg-num');
  if(bgNum){
    bgNum.style.opacity='0';
    setTimeout(()=>{
      bgNum.textContent = String(n).padStart(2,'0');
      bgNum.style.opacity='1';
    }, 220);
  }

  // Progress timeline fill
  const fill = document.getElementById('day-timeline-fill');
  if(fill) fill.style.width = ((n/3)*100)+'%';

  // Timeline dots
  [null,'dtd-2','dtd-3'].forEach((id,i)=>{
    if(!id) return;
    const dot = document.getElementById(id);
    if(dot) dot.classList.toggle('lit', n > i+1);
  });

  // Day 3 method reveal
  if(n===3){
    ['ms1','ms2','ms3'].forEach((id,i)=>{
      setTimeout(()=>{
        const el=document.getElementById(id);
        if(el) el.classList.add('vis');
      },i*180);
    });
  }

    // Scroll to panel content so user sees the text
      setTimeout(()=>{
          const activePanel = document.getElementById('panel-'+n);
              if(activePanel){
                    activePanel.scrollIntoView({behavior:'smooth', block:'start'});
                        }
                          }, 180);
}

/* ─────────────────────────────────
   TICKET SELECTION
───────────────────────────────── */
function selectTicket(card, tier){
  document.querySelectorAll('.ticket-card').forEach(c=>c.classList.remove('selected'));
  card.classList.add('selected');
  // Scroll to register CTA
  setTimeout(()=>document.getElementById('register').scrollIntoView({behavior:'smooth'}), 400);
}

/* ─────────────────────────────────
   FAQ ACCORDION
───────────────────────────────── */
function toggleFaq(btn){
  const item = btn.parentElement;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i=>{
    i.classList.remove('open');
    i.querySelector('.faq-q').setAttribute('aria-expanded','false');
  });
  if(!isOpen){
    item.classList.add('open');
    btn.setAttribute('aria-expanded','true');
  }
}

/* ─────────────────────────────────
   VIDEO MODAL
───────────────────────────────── */
function openModal(title, icon){
  document.getElementById('modal-title-text').textContent = title;
  document.getElementById('modal-icon').textContent = icon;
  const modal = document.getElementById('video-modal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(){
  document.getElementById('video-modal').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

/* ─────────────────────────────────
   AUDIO — Voz de José (solo al pulsar botón)
───────────────────────────────── */
(function(){
  const audio = document.getElementById('jose-audio');
  const wave  = document.getElementById('jose-wave');
  if(!audio) return;
  audio.volume = 0.85;
  function showWave(){ if(wave) wave.classList.add('playing'); }
  function hideWave(){ if(wave) wave.classList.remove('playing'); }
  audio.addEventListener('playing', showWave);
  audio.addEventListener('pause',   hideWave);
  audio.addEventListener('ended',   hideWave);
})();

/* ─────────────────────────────────
   AMBIENT AUDIO (Web Audio API — non-invasive)
───────────────────────────────── */
let ambientCtx = null;
let ambientOn = false;
let ambientNodes = [];
let ambientTriggered = false;

function triggerAmbient(){
  if(ambientTriggered) return;
  ambientTriggered = true;
  startAmbient();
}

function startAmbient(){
  if(ambientCtx) return;
  try {
    ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
    ambientOn = true;

    // Subtle intro chime
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5 — major chord
    notes.forEach((freq, i)=>{
      const osc  = ambientCtx.createOscillator();
      const gain = ambientCtx.createGain();
      osc.connect(gain); gain.connect(ambientCtx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ambientCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.035, ambientCtx.currentTime + 0.4 + i*0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, ambientCtx.currentTime + 3.5);
      osc.start(ambientCtx.currentTime + i*0.05);
      osc.stop(ambientCtx.currentTime + 4);
    });

    // Show indicator briefly
    const bar = document.getElementById('sound-bar');
    bar.classList.add('show');
    setTimeout(()=>bar.classList.remove('show'), 3500);

    // Update toggle
    const wave = document.getElementById('nav-wave');
    wave.classList.remove('paused');
    document.getElementById('audio-label').textContent = 'Sonando';

  } catch(e){ /* silent fail */ }
}

function toggleAmbient(){
  const audio = document.getElementById('jose-audio');
  const wave  = document.getElementById('nav-wave');
  const lbl   = document.getElementById('audio-label');

  if(!ambientCtx){
    // Primera vez: iniciar ambient + reproducir voz
    triggerAmbient();
    if(audio) audio.play().catch(()=>{});
    return;
  }

  ambientOn = !ambientOn;
  if(ambientOn){
    wave.classList.remove('paused');
    lbl.textContent = 'Sonando';
    if(audio) audio.play().catch(()=>{});
    // Chime de confirmación
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq,i)=>{
      const osc  = ambientCtx.createOscillator();
      const gain = ambientCtx.createGain();
      osc.connect(gain); gain.connect(ambientCtx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ambientCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.03, ambientCtx.currentTime + 0.3 + i*0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, ambientCtx.currentTime + 3);
      osc.start(); osc.stop(ambientCtx.currentTime + 3.5);
    });
  } else {
    wave.classList.add('paused');
    lbl.textContent = 'Sonido';
    if(audio) audio.pause();
  }
}

/* ─────────────────────────────────
   TIME ON PAGE — engagement hook
───────────────────────────────── */
const timeToast = document.getElementById('time-toast');
const milestones = [
  {t:30,  msg:'🔥 ¡Casi te convencemos! Mira los tickets'},
  {t:90,  msg:'🚀 Los cupos High Ticket se agotan rápido'},
  {t:180, msg:'⏰ Noche de Gala: miércoles 28 · 7:30 PM. Conferencias: jueves 29 · 8:00 AM a 7:00 PM'},
];
let shownMilestones = new Set();
const startTime = Date.now();

setInterval(()=>{
  const elapsed = Math.floor((Date.now()-startTime)/1000);
  milestones.forEach(m=>{
    if(elapsed >= m.t && !shownMilestones.has(m.t)){
      shownMilestones.add(m.t);
      timeToast.textContent = m.msg;
      timeToast.classList.add('show');
      setTimeout(()=>timeToast.classList.remove('show'), 4000);
    }
  });
}, 1000);

/* ─────────────────────────────────
   PARTICLES
───────────────────────────────── */
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let W, H, pts = [];

function resize(){
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

class Pt {
  constructor(){ this.reset() }
  reset(){
    this.x  = Math.random()*W; this.y = Math.random()*H;
    this.r  = Math.random()*1.6+.3;
    this.vx = (Math.random()-.5)*.28; this.vy = (Math.random()-.5)*.28;
    this.a  = Math.random()*.45+.08;
  }
  step(){ this.x+=this.vx; this.y+=this.vy; if(this.x<0||this.x>W||this.y<0||this.y>H) this.reset(); }
  draw(){ ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fillStyle=`rgba(168,85,247,${this.a})`; ctx.fill(); }
}
/* Menos puntos y a ~30 cuadros: el fondo no compite con el carrusel ni con el scroll.
   Las líneas se dibujan por lotes (3 trazos en vez de cientos). */
const _movil = window.innerWidth < 769;
const _quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const N_PTS = _movil ? 24 : 46, DIST = 110;
for(let i=0;i<N_PTS;i++) pts.push(new Pt());
let _ult = 0;
function anim(t){
  requestAnimationFrame(anim);
  if(_quieto || document.hidden || t-_ult < 32) return;
  _ult = t;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='rgba(168,85,247,.32)';
  ctx.beginPath();
  pts.forEach(p=>{ p.step(); ctx.moveTo(p.x+p.r,p.y); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); });
  ctx.fill();
  const lotes=[[],[],[]];
  for(let i=0;i<pts.length;i++){
    for(let j=i+1;j<pts.length;j++){
      const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
      const d2=dx*dx+dy*dy;
      if(d2<DIST*DIST){ const f=1-Math.sqrt(d2)/DIST; lotes[f>.66?2:f>.33?1:0].push(i,j); }
    }
  }
  ctx.lineWidth=.7;
  for(let k=0;k<3;k++){
    if(!lotes[k].length) continue;
    ctx.strokeStyle='rgba(168,85,247,'+[.03,.065,.1][k]+')';
    ctx.beginPath();
    const L=lotes[k];
    for(let n=0;n<L.length;n+=2){ ctx.moveTo(pts[L[n]].x,pts[L[n]].y); ctx.lineTo(pts[L[n+1]].x,pts[L[n+1]].y); }
    ctx.stroke();
  }
}
requestAnimationFrame(anim);

/* ─────────────────────────────────
   HERO MOUSE PARALLAX
───────────────────────────────── */
const heroEl = document.getElementById('hero');
heroEl.addEventListener('mousemove', e=>{
  const cx=window.innerWidth/2, cy=window.innerHeight/2;
  const dx=(e.clientX-cx)/cx, dy=(e.clientY-cy)/cy;
  document.querySelector('.g1').style.transform=`translateX(calc(-50% + ${dx*22}px)) translateY(${dy*12}px)`;
  document.querySelector('.hero-frame').style.transform=`translate(calc(-50% + ${dx*7}px),calc(-50% + ${dy*7}px))`;
});

/* ─────────────────────────────────
   MYSTERY SPEAKERS
───────────────────────────────── */
const mysteryHints = [
  '🔥 Pista: Es referente latinoamericano en IA. ¡Sigue nuestras redes!',
  '⚡ Pista: Ha hablado en +20 países. Solo en High Ticket.',
  '🌎 Este invitado cambiará la perspectiva del ecosistema. ¡Muy pronto!',
];
let mysteryIdx = 0;
function showMysteryHint(card){
  const toast = document.getElementById('mystery-toast');
  const idx   = Array.from(card.parentElement.children).filter(c=>c.classList.contains('mystery')).indexOf(card);
  toast.textContent = mysteryHints[idx] || mysteryHints[0];
  toast.style.display = 'block';
  clearTimeout(window._mTimer);
  window._mTimer = setTimeout(()=>{ toast.style.display='none'; }, 3500);
  // Pulse the card
  card.style.transition = 'transform .2s';
  card.style.transform  = 'scale(1.04)';
  setTimeout(()=>{ card.style.transform = ''; }, 300);
}

/* ─────────────────────────────────
   KEYBOARD VIDEO CARDS
───────────────────────────────── */
document.querySelectorAll('.video-card').forEach(card=>{
  card.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' ') card.click(); });
});

/* ─────────────────────────────────
   BANDA DE PATROCINADORES: luz neón que sigue el cursor
   (solo con mouse; la banda se detiene mientras el cursor está encima)
───────────────────────────────── */
(function(){
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  document.querySelectorAll('.luz').forEach(zona=>{
    const fichas = Array.from(zona.querySelectorAll('.logo-tile'));
    let x = 0, y = 0, pendiente = false;
    function pintar(){
      pendiente = false;
      const ancho = window.innerWidth;
      fichas.forEach(f=>{
        const r = f.getBoundingClientRect();
        if(r.right < 0 || r.left > ancho) return;   // solo las que se ven
        f.style.setProperty('--mx', (x - r.left) + 'px');
        f.style.setProperty('--my', (y - r.top) + 'px');
      });
    }
    zona.addEventListener('pointermove', e=>{
      x = e.clientX; y = e.clientY;
      if(!pendiente){ pendiente = true; requestAnimationFrame(pintar); }
    }, {passive:true});
  });
})();

/* ─────────────────────────────────
   LOGOS DE PATROCINADORES Y ALIADOS: se piden un poco antes de llegar
   a la sección, así ninguno aparece tarde cuando entra a la banda
───────────────────────────────── */
(function(){
  const sec = document.getElementById('sponsors');
  if(!sec || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entradas=>{
    if(entradas.some(e=>e.isIntersecting)){
      sec.querySelectorAll('.logo-tile img[loading="lazy"]').forEach(i=>{ i.loading = 'eager'; });
      io.disconnect();
    }
  }, {rootMargin:'800px 0px'});
  io.observe(sec);
})();
