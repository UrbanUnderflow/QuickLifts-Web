(() => {
document.documentElement.classList.add('js');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Match the app's five check-in symbols across the website.
const MOODS = {tough:{label:'Tough'},heavy:{label:'Heavy'},okay:{label:'Okay'},good:{label:'Good'},great:{label:'Great'}};
const paths = {
 tough: '<path d="M3 22h5l2-8 3 17 3-25 3 32 3-36 3 35 3-27 3 21 3-16 3 7h4"/>',
 heavy: '<path d="M11 33h23a8 8 0 0 0 0-16 12 12 0 0 0-23-2 9 9 0 0 0 0 18Z"/>',
 okay: '<path d="M7 22h30"/>',
 good: '<path fill="currentColor" stroke="none" d="M22 38C17 34 3 25 3 14 3 3 17 1 22 10 27 1 41 3 41 14 41 25 27 34 22 38Z"/>',
 great: '<circle cx="22" cy="22" r="17"/><circle cx="16" cy="17" r="1.5" fill="currentColor" stroke="none"/><circle cx="28" cy="17" r="1.5" fill="currentColor" stroke="none"/><path d="M14 25q8 11 16 0"/>'
};
const face = key => `<svg viewBox="0 0 44 44" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg>`;
document.querySelectorAll('[data-face]').forEach(el => el.insertAdjacentHTML('afterbegin', face(el.dataset.face)));

// Scroll reveals
const revealTargets = document.querySelectorAll('main > section:not(.hero), .team-preview');
const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
 if (!entry.isIntersecting) return;
 entry.target.classList.add('is-visible');
 if (entry.target.classList.contains('team-preview')) countUp(entry.target);
 revealObserver.unobserve(entry.target);
}), {threshold: .15});
revealTargets.forEach(el => { if (!el.classList.contains('team-preview')) el.classList.add('reveal'); revealObserver.observe(el); });

function countUp(scope) {
 scope.querySelectorAll('.phone-metrics strong').forEach(el => {
  const target = parseInt(el.textContent, 10);
  if (reduceMotion || Number.isNaN(target)) return;
  const start = performance.now();
  const tick = now => {
   const t = Math.min(1, (now - start) / 1100);
   el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + '%';
   if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 });
}

// Product steps follow the reader down the page
const productSteps = [...document.querySelectorAll('.product .steps li')];
if (productSteps.length) {
 productSteps[0].classList.add('is-current');
 const stepObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  productSteps.forEach(li => li.classList.toggle('is-current', li === entry.target));
 }), {rootMargin: '-40% 0px -40% 0px'});
 productSteps.forEach(li => stepObserver.observe(li));
}

// Try a rep
const stage = document.querySelector('[data-try]');
if (stage) {
 const SKILLS = {
  relax: {name: '4-7-8 Relaxation Breathing', rounds: 3, phases: [['Breathe in', 4, 1], ['Hold', 7, 1], ['Breathe out', 8, .5]], pattern: 'In 4 · Hold 7 · Out 8'},
  box: {name: 'Box Breathing', rounds: 4, phases: [['Breathe in', 4, 1], ['Hold', 4, 1], ['Breathe out', 4, .5], ['Hold', 4, .5]], pattern: 'In 4 · Hold 4 · Out 4 · Hold 4'},
  sigh: {name: 'Physiological Sigh', rounds: 5, phases: [['Breathe in', 2, .85], ['Top it off', 1, 1], ['Long breath out', 6, .5]], pattern: 'In · In again · Long out'}
 };
 const skillFor = mood => (mood === 'tough' || mood === 'heavy') ? 'relax' : mood === 'okay' ? 'box' : 'sigh';
 const tone = mood => (mood === 'tough' || mood === 'heavy') ? 'low' : mood === 'okay' ? 'mid' : 'high';
 const CUES = ['One play at a time.', 'Next play.', 'Trust the work.'];
 const state = {recovery: null, mood: null, skill: null, run: 0};
 const $ = sel => stage.querySelector(sel);
 const steps = [...stage.querySelectorAll('[data-step]')];
 const dots = [...document.querySelectorAll('[data-step-dot]')];
 const continueBtn = $('[data-continue]');

 const showStep = n => {
  steps.forEach(step => { step.hidden = Number(step.dataset.step) !== n; });
  dots.forEach(dot => {
   const i = Number(dot.dataset.stepDot);
   dot.classList.toggle('is-active', i === n);
   dot.classList.toggle('is-done', i < n);
  });
  if (n !== 2) stopBreath();
  const heading = steps[n - 1].querySelector('h3');
  if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({preventScroll: true}); }
 };

 const selectRadio = (group, button) => {
  group.querySelectorAll('[role=radio]').forEach(item => {
   item.setAttribute('aria-checked', String(item === button));
   item.tabIndex = item === button ? 0 : -1;
  });
 };
 stage.querySelectorAll('[role=radiogroup]').forEach(group => {
  const radios = [...group.querySelectorAll('[role=radio]')];
  radios.forEach((r, i) => { r.tabIndex = i === 0 ? 0 : -1; });
  group.addEventListener('keydown', e => {
   const i = radios.indexOf(document.activeElement);
   if (i < 0 || !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
   e.preventDefault();
   const next = radios[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : radios.length - 1)) % radios.length];
   next.focus(); next.click();
  });
 });

 stage.querySelectorAll('[data-mood]').forEach(btn => btn.addEventListener('click', () => {
  state.mood = btn.dataset.mood;
  selectRadio(btn.parentElement, btn);
  $('[data-recovery-panel]').hidden = false;
  continueBtn.disabled = !state.recovery;
 }));
 stage.querySelectorAll('[data-recovery]').forEach(btn => btn.addEventListener('click', () => {
  state.recovery = btn.dataset.recovery;
  selectRadio(btn.parentElement, btn);
  continueBtn.disabled = !state.mood;
 }));
 document.querySelectorAll('a[data-moment]').forEach(link => link.addEventListener('click', () => showStep(1)));

 continueBtn.addEventListener('click', () => {
  state.skill = SKILLS[skillFor(state.mood)];
  $('[data-skill-name]').textContent = state.skill.name;
  $('[data-nora-line]').textContent = 'Thanks for checking in. Take a moment to follow the breathing pattern.';
  $('[data-breath-pattern]').textContent = state.skill.pattern;
  resetBreath();
  showStep(2);
 });

 // Breathing orb
 const glow = $('.breath-glow'), core = $('.breath-core'), ring = $('.breath-ring');
 const phaseEl = $('[data-breath-phase]'), countEl = $('[data-breath-count]'), roundEl = $('[data-breath-round]');
 const startBtn = $('[data-breath-start]'), toCueBtn = $('[data-to-cue]');
 const CIRC = 2 * Math.PI * 46;
 ring.style.strokeDasharray = CIRC;
 const timers = [];
 const later = (fn, ms) => timers.push(setTimeout(fn, ms));
 const setOrb = (scale, secs) => {
  [glow, core].forEach((el, i) => {
   el.style.transitionDuration = reduceMotion ? '0s' : secs + 's';
   el.style.transform = `scale(${i ? scale * .82 : scale})`;
  });
 };
 const sweepRing = secs => {
  ring.style.transition = 'none';
  ring.style.strokeDashoffset = CIRC;
  ring.getBoundingClientRect();
  ring.style.transition = `stroke-dashoffset ${secs}s linear`;
  ring.style.strokeDashoffset = 0;
 };
 function stopBreath() { state.run++; timers.splice(0).forEach(clearTimeout); }
 function resetBreath() {
  stopBreath();
  setOrb(.55, .6);
  ring.style.transition = 'none'; ring.style.strokeDashoffset = CIRC;
  phaseEl.textContent = 'Ready';
  countEl.textContent = '';
  roundEl.textContent = `${state.skill.rounds} rounds`;
  startBtn.hidden = false; startBtn.textContent = 'Start breathing';
  toCueBtn.textContent = 'Skip to your cue';
 }
 startBtn.addEventListener('click', () => {
  stopBreath();
  const run = state.run, skill = state.skill;
  startBtn.hidden = true;
  let elapsed = 0;
  for (let round = 1; round <= skill.rounds; round++) {
   skill.phases.forEach(([label, secs, scale]) => {
    later(() => {
     if (run !== state.run) return;
     phaseEl.textContent = label;
     roundEl.textContent = `Round ${round} of ${skill.rounds}`;
     setOrb(scale, secs);
     sweepRing(secs);
     for (let s = 0; s < secs; s++) later(() => { if (run === state.run) countEl.textContent = secs - s; }, s * 1000);
    }, elapsed * 1000);
    elapsed += secs;
   });
  }
  later(() => {
   if (run !== state.run) return;
   setOrb(.55, 1.2);
   phaseEl.textContent = 'Nice work.';
   countEl.textContent = '';
   roundEl.textContent = `${skill.rounds} rounds complete`;
   toCueBtn.textContent = 'Choose your cue';
   startBtn.hidden = false; startBtn.textContent = 'Go again';
  }, elapsed * 1000);
 });
 document.addEventListener('visibilitychange', () => { if (document.hidden && !steps[1].hidden) resetBreath(); });

 toCueBtn.addEventListener('click', () => {
  const grid = $('[data-cues]');
  grid.innerHTML = '';
  CUES.forEach(cue => {
   const b = document.createElement('button');
   b.type = 'button'; b.className = 'cue'; b.textContent = cue;
   b.addEventListener('click', () => chooseCue(cue));
   grid.appendChild(b);
  });
  grid.hidden = false;
  $('[data-cue-card]').hidden = true;
  $('[data-cue-done]').hidden = true;
  $('[data-cue-title]').textContent = 'Pick a cue to take into sport.';
  showStep(3);
 });
 function chooseCue(cue) {
  $('[data-cues]').hidden = true;
  $('[data-cue-title]').textContent = 'Take it with you.';
  $('[data-cue-text]').textContent = cue;
  $('[data-cue-card]').hidden = false;
  $('[data-cue-summary]').textContent = `Checked in feeling ${MOODS[state.mood].label.toLowerCase()}, body feeling ${state.recovery.toLowerCase()}. Practiced ${state.skill.name}.`;
  $('[data-cue-done]').hidden = false;
 }
 $('[data-restart]').addEventListener('click', () => {
  state.mood = null;
  state.recovery = null;
  $('[data-recovery-panel]').hidden = true;
  stage.querySelectorAll('[data-recovery]').forEach((b, i) => { b.setAttribute('aria-checked', 'false'); b.tabIndex = i === 0 ? 0 : -1; });
  stage.querySelectorAll('[data-mood]').forEach(b => b.setAttribute('aria-checked', 'false'));
  continueBtn.disabled = true;
  showStep(1);
 });
}

// Privacy lens
const lens = document.querySelector('[data-lens]');
if (lens) {
 const tabs = [...document.querySelectorAll('[data-lens-tab]')];
 const pill = document.querySelector('.lens-pill');
 const viewer = document.querySelector('[data-lens-viewer]');
 const foot = document.querySelector('[data-lens-foot]');
 const journal = lens.querySelector('.journal-text');
 const toggle = lens.querySelector('.share-toggle');
 const FOOT = {
  athlete: 'This is Jordan’s own view. Everything they wrote is here, and they decide what gets shared.',
  coach: 'Coaches see that the work happened. Not what was said.',
  trainer: () => lens.dataset.moodShared === 'true'
   ? 'Jordan chose to share their mood, so the trainer sees it. The journal stays private either way.'
   : 'Jordan hasn’t shared their mood. Switch to Athlete and flip the share switch to see this change.'
 };
 const VIEWER = {athlete: 'Jordan’s view', coach: 'Coach view', trainer: 'Trainer view'};
 const setLens = (name, focus) => {
  lens.dataset.lens = name;
  tabs.forEach((tab, i) => {
   const on = tab.dataset.lensTab === name;
   tab.setAttribute('aria-selected', String(on));
   tab.tabIndex = on ? 0 : -1;
   if (on) { pill.style.transform = `translateX(${i * 100}%)`; if (focus) tab.focus(); }
  });
  viewer.textContent = VIEWER[name];
  foot.textContent = typeof FOOT[name] === 'function' ? FOOT[name]() : FOOT[name];
  journal.setAttribute('aria-hidden', String(name !== 'athlete'));
 };
 tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => setLens(tab.dataset.lensTab));
  tab.addEventListener('keydown', e => {
   if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
   const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
   setLens(next.dataset.lensTab, true);
  });
 });
 toggle.addEventListener('click', () => {
  const on = toggle.getAttribute('aria-checked') !== 'true';
  toggle.setAttribute('aria-checked', String(on));
  lens.dataset.moodShared = String(on);
 });
 setLens('athlete');
}
})();
