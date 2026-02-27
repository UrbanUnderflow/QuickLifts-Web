// ─── HELPERS ───
function splitWords(el) {
    el.innerHTML = el.textContent.split(' ').map(w => `<span class="word">${w}</span>`).join(' ');
}

function splitChars(el) {
    const html = el.innerHTML;
    const parts = html.split(/<br\s*\/?>/i);
    el.innerHTML = parts.map((part, i) =>
        (i > 0 ? '<br>' : '') + part.trim().split('').map(c =>
            c === ' ' ? '<span class="char" style="width:.3em;display:inline-block">&nbsp;</span>'
                : `<span class="char">${c}</span>`
        ).join('')
    ).join('');
}

function splitCharsAccent(el, accentText) {
    const parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts.map((part, pi) => {
        const isAccent = part.trim().toLowerCase().includes(accentText.toLowerCase());
        return (pi > 0 ? '<br>' : '') + part.trim().split('').map(c =>
            c === ' ' ? '<span class="char" style="width:.3em;display:inline-block">&nbsp;</span>'
                : `<span class="char${isAccent ? ' accent' : ''}">${c}</span>`
        ).join('');
    }).join('');
}

function typewriterChars(el) {
    const text = el.textContent;
    el.innerHTML = text.split('').map(c =>
        c === ' ' ? '<span class="char" style="width:.3em;display:inline-block">&nbsp;</span>'
            : `<span class="char">${c}</span>`
    ).join('');
}

function animateEl(id, cls, delay) {
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.classList.add(cls);
    }, delay || 0);
}

// ─── FLOATING PARTICLES ───
(function initParticles() {
    const box = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.opacity = (0.05 + Math.random() * 0.1).toFixed(2);
        box.appendChild(p);
    }
    (function animP() {
        const t = performance.now() / 1000;
        const ps = box.querySelectorAll('.particle');
        ps.forEach((p, i) => {
            const x = Math.sin(t * 0.3 + i * 0.7) * 20;
            const y = Math.cos(t * 0.2 + i * 0.5) * 15;
            p.style.transform = `translate(${x}px,${y}px)`;
        });
        requestAnimationFrame(animP);
    })();
})();

// ─── TIMELINE ───
const SCENES = [
    {
        id: 'scene-0', dur: 3500, setup() {
            typewriterChars(document.getElementById('intro-line'));
        }, enter() {
            animateEl('intro-flicker', 'in', 0);
            const chars = document.querySelectorAll('#intro-line .char');
            chars.forEach((c, i) => setTimeout(() => c.classList.add('in'), 1200 + i * 45));
        }
    },
    {
        id: 'scene-1', dur: 3200, setup() {
            splitWords(document.getElementById('t-top'));
            splitWords(document.getElementById('t-mid'));
        }, enter() {
            const w1 = document.querySelectorAll('#t-top .word');
            const w2 = document.querySelectorAll('#t-mid .word');
            w1.forEach((w, i) => setTimeout(() => w.classList.add('in'), 100 + i * 150));
            w2.forEach((w, i) => setTimeout(() => w.classList.add('in'), 100 + w1.length * 150 + i * 150));
        }
    },
    {
        id: 'scene-2', dur: 5500, enter() {
            animateEl('ladder-label', 'in', 0);
            const rows = ['rr-e', 'rr-d', 'rr-c', 'rr-b', 'rr-a', 'rr-s'];
            rows.forEach((id, i) => animateEl(id, 'in', 300 + i * 350));
        }
    },
    {
        id: 'scene-3', dur: 5500, setup() {
            splitChars(document.getElementById('s3-h'));
        }, enter() {
            animateEl('s3-tag', 'in', 0);
            document.querySelectorAll('#s3-h .char').forEach((c, i) =>
                setTimeout(() => c.classList.add('in'), 100 + i * 30));
            animateEl('s3-p', 'in', 0);
            animateEl('phone-3', 'in', 200);
            document.querySelector('#scene-3 .phone-glow').classList.add('in');
            animateEl('xp-card', 'in', 800);
            // Animate XP bar fill
            setTimeout(() => {
                document.getElementById('xp-fill').style.width = '62%';
            }, 1200);
            // Stagger breakdown rows
            animateEl('xb1', 'in', 1800);
            animateEl('xb2', 'in', 2050);
            animateEl('xb3', 'in', 2300);
            animateEl('xb4', 'in', 2550);
        }
    },
    {
        id: 'scene-4', dur: 5000, enter() {
            animateEl('rankup-flash', 'in', 0);
            animateEl('rankup-text', 'in', 300);
            animateEl('rankup-div', 'in', 300);
            animateEl('rankup-badge', 'in', 600);
            animateEl('rankup-name', 'in', 600);
            animateEl('rankup-title', 'in', 600);
            animateEl('rankup-trans', 'in', 600);
        }
    },
    {
        id: 'scene-5', dur: 5500, setup() {
            splitChars(document.getElementById('s5-h'));
        }, enter() {
            animateEl('s5-tag', 'in', 0);
            document.querySelectorAll('#s5-h .char').forEach((c, i) =>
                setTimeout(() => c.classList.add('in'), 100 + i * 30));
            animateEl('s5-p', 'in', 0);
            const phone = document.getElementById('phone-5');
            phone.style.transform = 'perspective(800px) rotateY(25deg) translateX(-60px) scale(.9)';
            animateEl('phone-5', 'in-right', 200);
            document.querySelector('#scene-5 .phone-glow').classList.add('in');
            animateEl('class-main', 'in', 600);
            animateEl('cl1', 'in', 1200);
            animateEl('cl2', 'in', 1400);
            animateEl('cl3', 'in', 1600);
            animateEl('cl4', 'in', 1800);
            // Animate class fill bars
            setTimeout(() => {
                document.querySelectorAll('.cl-fill').forEach(f => {
                    f.style.width = f.parentElement.querySelector('.cl-fill') === f ?
                        f.style.width : f.style.width; // trigger from CSS stored width
                    const target = f.getAttribute('style').match(/width:(\d+)%/);
                    if (target) {
                        f.style.width = '0%';
                        setTimeout(() => { f.style.width = target[1] + '%'; }, 50);
                    }
                });
            }, 1300);
        }
    },
    {
        id: 'scene-6', dur: 4500, setup() {
            const el = document.getElementById('hunt-h');
            el.innerHTML = 'Be the<br>hunter.';
            splitCharsAccent(el, 'hunter.');
        }, enter() {
            animateEl('hunt-tag', 'in', 0);
            document.querySelectorAll('#hunt-h .char').forEach((c, i) =>
                setTimeout(() => c.classList.add('in'), 200 + i * 40));
            animateEl('hunt-sub', 'in', 0);
            animateEl('hunt-cta', 'in', 0);
            setTimeout(() => document.getElementById('replay-btn').classList.add('show'), 2000);
        }
    }
];

const CROSSFADE = 500;
let currentScene = -1;
let totalDuration = SCENES.reduce((a, s) => a + s.dur, 0);
let startTime = 0;
let rafId = null;

SCENES.forEach(s => { if (s.setup) s.setup(); });

function startShow() {
    document.getElementById('play-overlay').classList.add('hidden');
    currentScene = -1;
    startTime = performance.now();
    nextScene();
    updateProgress();
}

function nextScene() {
    currentScene++;
    if (currentScene >= SCENES.length) return;
    const scene = SCENES[currentScene];
    const el = document.getElementById(scene.id);
    if (currentScene > 0) {
        const prev = document.getElementById(SCENES[currentScene - 1].id);
        prev.style.transition = `opacity ${CROSSFADE}ms ease`;
        prev.style.opacity = '0';
    }
    setTimeout(() => {
        el.style.transition = `opacity ${CROSSFADE}ms ease`;
        el.style.opacity = '1';
        scene.enter();
    }, currentScene === 0 ? 0 : CROSSFADE * 0.4);
    setTimeout(nextScene, scene.dur);
}

function updateProgress() {
    const pct = Math.min((performance.now() - startTime) / totalDuration * 100, 100);
    document.getElementById('progress').style.width = pct + '%';
    if (pct < 100) rafId = requestAnimationFrame(updateProgress);
}

function replay() {
    document.querySelectorAll('.scene').forEach(s => { s.style.opacity = '0'; s.style.transition = 'none'; });
    document.querySelectorAll('.in,.in-right').forEach(el => {
        el.classList.remove('in', 'in-right');
        el.style.opacity = ''; el.style.transform = '';
    });
    document.querySelectorAll('.word,.char').forEach(w => w.classList.remove('in'));
    document.getElementById('xp-fill').style.width = '0%';
    document.querySelectorAll('.cl-fill').forEach(f => f.style.width = '0%');
    document.getElementById('progress').style.width = '0%';
    document.getElementById('replay-btn').classList.remove('show');
    document.querySelectorAll('.phone-glow').forEach(g => g.classList.remove('in'));
    if (rafId) cancelAnimationFrame(rafId);
    setTimeout(startShow, 100);
}

// Ambient orb float
(function animOrbs() {
    const orbs = document.querySelectorAll('.orb');
    const t = performance.now() / 1000;
    if (orbs[0]) orbs[0].style.transform = `translate(${Math.sin(t * .3) * 40}px,${Math.cos(t * .2) * 30}px)`;
    if (orbs[1]) orbs[1].style.transform = `translate(${Math.cos(t * .25) * 30}px,${Math.sin(t * .35) * 40}px)`;
    if (orbs[2]) orbs[2].style.transform = `translate(${Math.sin(t * .4) * 20}px,${Math.cos(t * .3) * 25}px)`;
    requestAnimationFrame(animOrbs);
})();
