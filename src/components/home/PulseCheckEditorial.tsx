import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './PulseCheckEditorial.module.css';

export default function PulseCheckEditorial({ onDemo }: { onDemo: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!media.matches) video.current?.play().catch(() => {});
    const stop = () => { if (media.matches) video.current?.pause(); };
    media.addEventListener('change', stop);
    return () => media.removeEventListener('change', stop);
  }, []);
  return <main id="top" className={styles.page}>
    <section className={styles.hero}>
      <video ref={video} muted loop playsInline preload="metadata" poster="/pil-og-source.jpg" aria-hidden="true" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}><source src="/pil-hero.mp4" type="video/mp4" /></video>
      <div className={styles.shade} />
      <div className={styles.heroCopy}><p className={styles.label}>Pulse Intelligence Labs / Introducing PulseCheck</p><h1>Practice for<br/><em>the pressure.</em></h1><p className={styles.intro}>Mental skills for the moments that matter.<br/>A daily practice for athletes. A shared routine for teams.</p><div className={styles.actions}><button onClick={onDemo} className={styles.primary}>Explore PulseCheck <span aria-hidden="true">↗</span></button><a href="#pulsecheck">See the experience ↓</a></div></div>
      <div className={styles.heroFoot}><span>Built around the athlete.</span><button onClick={() => { if (video.current?.paused) video.current.play().catch(() => {}); else video.current?.pause(); }} aria-label={playing ? 'Pause background video' : 'Play background video'}>{playing ? 'Pause film' : 'Play film'}</button></div>
    </section>
    <section id="pulsecheck" className={styles.athlete}>
      <div className={styles.story}><p className={styles.label}>01 / The daily practice</p><h2>A moment to check in.<br/><em>A skill to take with you.</em></h2><p className={styles.body}>Before practice. After a hard day. Ahead of the next game. PulseCheck gives athletes a place to notice how they feel and practice the mental skills they can bring into sport.</p><ol className={styles.steps}><li><span>01</span><div><h3>Check in with yourself.</h3><p>Start with how the day felt.</p></div></li><li><span>02</span><div><h3>Practice one skill.</h3><p>Follow a short, guided mental training session.</p></div></li><li><span>03</span><div><h3>Bring it to the next play.</h3><p>Choose a cue to try at practice or in a game.</p></div></li></ol></div>
      <figure className={styles.phoneStage}><div className={styles.phone}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/athleticmind/assets/athlete-app.png" alt="Updated athlete app preview showing an evening check-in and today's guided breathing practice" width="1206" height="2622" /></div><figcaption>Athlete experience / App preview</figcaption></figure>
    </section>
    <section id="coaches" className={styles.coaches}><div className={styles.coachHeading}><div><p className={styles.label}>02 / The team perspective</p><h2>See the routine.<br/><em>Support the team.</em></h2></div><p className={styles.body}>Help mental practice become part of the week. The coach view brings participation, skill training and wearable coverage into one place.</p></div>
      <figure className={styles.dashboard}><div className={styles.dashboardCrop}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/athleticmind/assets/approved-coach-trainer.png" width="1095" height="1445" alt="Coach dashboard preview showing check-in participation, skill training, wearable coverage and an athlete participation roster" loading="lazy" /></div><figcaption>Coach workspace shown in Athletic Mind branding. Illustrative data.</figcaption></figure>
      <div className={styles.coachNotes}><div><h3>Follow participation.</h3><p>See the routine across the team and where it needs attention.</p></div><div><h3>Know what they are practicing.</h3><p>Keep the current skill in view when planning the week.</p></div><div><h3>Respect their private space.</h3><p>Coaches see participation. Private reflections stay private.</p></div></div>
    </section>
    <section className={styles.close}><p className={styles.label}>PulseCheck / Built by Pulse Intelligence Labs</p><h2>Make mental practice<br/><em>part of the week.</em></h2><button onClick={onDemo} className={styles.primary}>See it with your team <span aria-hidden="true">↗</span></button></section>
    <aside className={styles.other}><div><p className={styles.label}>More from the lab</p><p>Explore the full Pulse Intelligence Labs product suite.</p></div><Link href="/PIL/products">Explore our other products ↗</Link></aside>
  </main>;
}
