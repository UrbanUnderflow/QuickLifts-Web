// ─── HELPERS ───
function splitWords(el) {
    const text = el.textContent;
    el.innerHTML = text.split(' ').map(w => `<span class="word">${w}</span>`).join(' ');
}

function splitChars(el) {
    const html = el.innerHTML;
    // Handle <br> tags
    const parts = html.split(/<br\s*\/?>/i);
    el.innerHTML = parts.map((part, i) => {
        const chars = part.trim().split('').map(c =>
            c === ' ' ? '<span class="char" style="width:.3em;display:inline-block">&nbsp;</span>'
                : `<span class="char">${c}</span>`
        ).join('');
        return (i > 0 ? '<br>' : '') + chars;
    }).join('');
}

function splitCharsAccent(el, accentText) {
    const html = el.innerHTML;
    const parts = html.split(/<br\s*\/?>/i);
    el.innerHTML = parts.map((part, pi) => {
        const isAccent = part.trim().toLowerCase().includes(accentText.toLowerCase());
        const chars = part.trim().split('').map(c =>
            c === ' ' ? '<span class="char" style="width:.3em;display:inline-block">&nbsp;</span>'
                : `<span class="char${isAccent ? ' accent' : ''}">${c}</span>`
        ).join('');
        return (pi > 0 ? '<br>' : '') + chars;
    }).join('');
}

function staggerIn(parentId, selector, cls, baseDelay, stagger) {
    const parent = document.getElementById(parentId) || document;
    const items = (parentId ? document.getElementById(parentId) : document).querySelectorAll(selector);
    items.forEach((el, i) => {
        setTimeout(() => el.classList.add(cls), baseDelay + i * stagger);
    });
}

function animateEl(id, cls, delay) {
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.classList.add(cls);
    }, delay || 0);
}

// ─── TIMELINE ───
const SCENES = [
    {
        id: 'scene-0', dur: 2600, enter(t) {
            animateEl('logo-mark', 'in', 100);
            animateEl('logo-text', 'in', 100);
            animateEl('logo-sub', 'in', 100);
        }
    },
    {
        id: 'scene-1', dur: 3800, setup() {
            splitWords(document.getElementById('hook-1'));
            splitWords(document.getElementById('hook-2'));
        }, enter() {
            const w1 = document.querySelectorAll('#hook-1 .word');
            const w2 = document.querySelectorAll('#hook-2 .word');
            w1.forEach((w, i) => setTimeout(() => w.classList.add('in'), 100 + i * 120));
            w2.forEach((w, i) => setTimeout(() => w.classList.add('in'), 100 + w1.length * 120 + i * 120));
        }
    },
    {
        id: 'scene-2', dur: 5200, setup() {
            splitChars(document.getElementById('s2-h'));
        }, enter() {
            animateEl('s2-tag', 'in', 0);
            const chars = document.querySelectorAll('#s2-h .char');
            chars.forEach((c, i) => setTimeout(() => c.classList.add('in'), 100 + i * 30));
            animateEl('s2-p', 'in', 0);
            animateEl('phone-2', 'in', 200);
            document.querySelector('#scene-2 .phone-glow').classList.add('in');
            animateEl('fc1', 'in', 800);
            animateEl('fc2', 'in', 1100);
            animateEl('fc3', 'in', 1400);
        }
    },
    {
        id: 'scene-3', dur: 5200, setup() {
            splitChars(document.getElementById('s3-h'));
        }, enter() {
            animateEl('s3-tag', 'in', 0);
            const chars = document.querySelectorAll('#s3-h .char');
            chars.forEach((c, i) => setTimeout(() => c.classList.add('in'), 100 + i * 30));
            animateEl('s3-p', 'in', 0);
            const phone = document.getElementById('phone-3');
            phone.style.transform = 'perspective(800px) rotateY(25deg) translateX(-60px) scale(.9)';
            animateEl('phone-3', 'in-right', 200);
            document.querySelector('#scene-3 .phone-glow').classList.add('in');
            // Tap animation at 3s
            setTimeout(() => {
                animateEl('tap-circle', 'in', 0);
                const btn = document.getElementById('join-btn');
                btn.style.transform = 'scale(.95)';
                btn.style.background = '#c8e00e';
                setTimeout(() => { btn.style.transform = ''; btn.style.background = ''; }, 200);
            }, 2800);
        }
    },
    {
        id: 'scene-4', dur: 5500, setup() {
            splitChars(document.getElementById('s4-h'));
        }, enter() {
            animateEl('s4-tag', 'in', 0);
            const chars = document.querySelectorAll('#s4-h .char');
            chars.forEach((c, i) => setTimeout(() => c.classList.add('in'), 100 + i * 30));
            animateEl('s4-p', 'in', 0);
            animateEl('phone-4', 'in', 200);
            document.querySelector('#scene-4 .phone-glow').classList.add('in');
            animateEl('pod2', 'in', 900);
            animateEl('pod1', 'in', 600);
            animateEl('pod3', 'in', 1200);
            animateEl('rr1', 'in', 1800);
            animateEl('rr2', 'in', 2100);
            animateEl('rr3', 'in', 2400);
        }
    },
    {
        id: 'scene-5', dur: 5500, setup() {
            splitChars(document.getElementById('s5-h'));
        }, enter() {
            animateEl('s5-tag', 'in', 0);
            const chars = document.querySelectorAll('#s5-h .char');
            chars.forEach((c, i) => setTimeout(() => c.classList.add('in'), 100 + i * 30));
            animateEl('s5-p', 'in', 0);
            const phone = document.getElementById('phone-5');
            phone.style.transform = 'perspective(800px) rotateY(25deg) translateX(-60px) scale(.9)';
            animateEl('phone-5', 'in-right', 200);
            document.querySelector('#scene-5 .phone-glow').classList.add('in');
            animateEl('win-trophy', 'in', 500);
            animateEl('win-title', 'in', 500);
            animateEl('win-sub', 'in', 500);
            animateEl('win-card', 'in', 500);
            animateEl('win-btn', 'in', 500);
            setTimeout(spawnConfetti, 700);
            setTimeout(() => {
                const t = document.getElementById('win-trophy');
                t.classList.remove('in');
                t.classList.add('glow');
            }, 1400);
        }
    },
    {
        id: 'scene-6', dur: 4500, setup() {
            const el = document.getElementById('close-h');
            el.innerHTML = 'Your crew is<br>waiting.';
            splitCharsAccent(el, 'waiting.');
        }, enter() {
            const chars = document.querySelectorAll('#close-h .char');
            chars.forEach((c, i) => setTimeout(() => c.classList.add('in'), i * 35));
            animateEl('close-sub', 'in', 0);
            animateEl('close-cta', 'in', 0);
            setTimeout(() => document.getElementById('replay-btn').classList.add('show'), 2000);
        }
    }
];

const CROSSFADE = 500;
let currentScene = -1;
let totalDuration = SCENES.reduce((a, s) => a + s.dur, 0);
let startTime = 0;
let rafId = null;

// Run all setup() once
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

    // Fade out previous
    if (currentScene > 0) {
        const prev = document.getElementById(SCENES[currentScene - 1].id);
        prev.style.transition = `opacity ${CROSSFADE}ms ease`;
        prev.style.opacity = '0';
    }

    // Fade in current
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

function spawnConfetti() {
    const box = document.getElementById('confetti-box');
    const colors = ['#E0FE10', '#3B82F6', '#8B5CF6', '#FFD700', '#EF4444', '#06B6D4', '#fff'];
    for (let i = 0; i < 60; i++) {
        const c = document.createElement('div');
        c.className = 'conf in';
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        c.style.left = Math.random() * 100 + '%';
        c.style.animationDuration = (1.5 + Math.random() * 2.5) + 's';
        c.style.animationDelay = (Math.random() * 1.2) + 's';
        c.style.width = (3 + Math.random() * 6) + 'px';
        c.style.height = (3 + Math.random() * 6) + 'px';
        box.appendChild(c);
    }
}

function replay() {
    document.querySelectorAll('.scene').forEach(s => { s.style.opacity = '0'; s.style.transition = 'none'; });
    document.querySelectorAll('.in,.in-right,.glow').forEach(el => {
        el.classList.remove('in', 'in-right', 'glow');
        el.style.opacity = ''; el.style.transform = ''; el.style.background = '';
    });
    document.querySelectorAll('.word').forEach(w => w.classList.remove('in'));
    document.querySelectorAll('.char').forEach(c => c.classList.remove('in'));
    document.getElementById('confetti-box').innerHTML = '';
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
    orbs[0].style.transform = `translate(${Math.sin(t * .3) * 40}px,${Math.cos(t * .2) * 30}px) scale(${1 + Math.sin(t * .15) * .1})`;
    orbs[1].style.transform = `translate(${Math.cos(t * .25) * 30}px,${Math.sin(t * .35) * 40}px) scale(${1 + Math.cos(t * .2) * .1})`;
    orbs[2].style.transform = `translate(${Math.sin(t * .4) * 20}px,${Math.cos(t * .3) * 25}px)`;
    requestAnimationFrame(animOrbs);
})();
