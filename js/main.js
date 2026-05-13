/* ─────────────────────────────────
   COUNTDOWN TIMER (hero + sticky bar)
───────────────────────────────── */
function updateCountdown(){
  const target = new Date('2026-09-18T19:30:00-05:00').getTime();
  const now    = new Date().getTime();
  const diff   = target - now;
  const zero   = ['00','00','00','00'];
  if(diff <= 0){
    ['cd-days','cd-hours','cd-mins','cd-secs'].forEach((id,i)=>{ const el=document.getElementById(id); if(el) el.textContent=zero[i]; });
    ['scd-d','scd-h','scd-m','scd-s'].forEach((id,i)=>{ const el=document.getElementById(id); if(el) el.textContent=zero[i]; });
    return;
  }
  const d = Math.floor(diff/(1000*60*60*24));
  const h = Math.floor((diff%(1000*60*60*24))/(1000*60*60));
  const m = Math.floor((diff%(1000*60*60))/(1000*60));
  const s = Math.floor((diff%(1000*60))/1000);
  const pad = n => String(n).padStart(2,'0');
  // Hero countdown
  const ids = ['cd-days','cd-hours','cd-mins','cd-secs'];
  [d,h,m,s].forEach((v,i)=>{ const el=document.getElementById(ids[i]); if(el) el.textContent=pad(v); });
  // Sticky bar countdown
  const sids = ['scd-d','scd-h','scd-m','scd-s'];
  [d,h,m,s].forEach((v,i)=>{ const el=document.getElementById(sids[i]); if(el) el.textContent=pad(v); });
  // Animate seconds tick
  const sEl = document.getElementById('scd-s');
  if(sEl){ sEl.style.transform='scale(1.2)'; setTimeout(()=>sEl.style.transform='',120); }
}
updateCountdown();
setInterval(updateCountdown, 1000);

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
  {t:180, msg:'⏰ Faltan '+Math.ceil((new Date('2026-09-18T19:30:00-05:00')-new Date())/(1000*60*60*24))+' días para el evento'},
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
for(let i=0;i<70;i++) pts.push(new Pt());

function anim(){
  ctx.clearRect(0,0,W,H);
  pts.forEach(p=>{ p.step(); p.draw(); });
  for(let i=0;i<pts.length;i++){
    for(let j=i+1;j<pts.length;j++){
      const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<110){ ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.strokeStyle=`rgba(168,85,247,${(1-d/110)*.1})`; ctx.lineWidth=.7; ctx.stroke(); }
    }
  }
  requestAnimationFrame(anim);
}
anim();

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
  '🌎 Este invitado cambiará la perspectiva del ecosistema. Anuncio: 1 Sep.',
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
