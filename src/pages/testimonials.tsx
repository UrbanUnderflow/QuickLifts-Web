import React, { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Quote } from 'lucide-react';
import PageHead from '../components/PageHead';

const pageMeta = {
  pageId: 'pulsecheck-testimonials',
  pageTitle: 'PulseCheck Testimonials | Coaches, Athletes, Parents, and Staff',
  metaDescription:
    'Read PulseCheck feedback from coaches, athletes, parents, and program leaders. Share your own testimonial for review.',
  ogTitle: 'PulseCheck Testimonials',
  ogDescription:
    'Stories from the people using PulseCheck to build mental performance in sport, school, work, and life.',
  ogImage: '/pulsecheck-pro-og-clean.png',
  twitterCard: 'summary_large_image',
  lastUpdated: '2026-08-02T00:00:00.000Z',
};

type TestimonialRole = 'coach' | 'athlete' | 'parent' | 'admin';

type Testimonial = {
  id: string;
  role: TestimonialRole;
  label: string;
  quote: string;
  name: string;
  context: string;
  takeaway: string;
};

const roleFilters: Array<{ id: 'all' | TestimonialRole; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'coach', label: 'Coaches' },
  { id: 'athlete', label: 'Athletes' },
  { id: 'parent', label: 'Parents' },
  { id: 'admin', label: 'Admin' },
];

const testimonials: Testimonial[] = [
  {
    id: 'coach-practice',
    role: 'coach',
    label: 'Coach',
    quote:
      'PulseCheck gives us a clean way to talk about the mental side without turning practice into a lecture.',
    name: 'Coach feedback',
    context: 'Team training environment',
    takeaway: 'Makes mental performance easier to bring into normal team rhythm.',
  },
  {
    id: 'athlete-pressure',
    role: 'athlete',
    label: 'Athlete',
    quote:
      'It helps me know what to do after a mistake instead of just hearing that I need to stay confident.',
    name: 'Athlete feedback',
    context: 'Competition week',
    takeaway: 'Turns advice into one clear skill the athlete can use.',
  },
  {
    id: 'parent-support',
    role: 'parent',
    label: 'Parent',
    quote:
      'I like that my child has support without feeling watched. The private check-in makes that part feel safer.',
    name: 'Parent feedback',
    context: 'Youth athlete support',
    takeaway: 'Gives parents confidence while protecting the athlete experience.',
  },
  {
    id: 'admin-rollout',
    role: 'admin',
    label: 'Admin',
    quote:
      'The value is that it fits into the program. Athletes can use it daily, and staff can see where support may be needed.',
    name: 'Program leader feedback',
    context: 'Organization rollout',
    takeaway: 'Helps staff support people without adding another heavy process.',
  },
];

const roleNotes = [
  {
    title: 'For coaches',
    body: 'Share what changed in practice, preparation, communication, or athlete follow-through.',
  },
  {
    title: 'For athletes',
    body: 'Share the moment PulseCheck helped with focus, confidence, pressure, or bouncing back.',
  },
  {
    title: 'For parents',
    body: 'Share what helped you understand or support your athlete without taking over their experience.',
  },
  {
    title: 'For admin',
    body: 'Share what helped with adoption, staff visibility, athlete support, or program trust.',
  },
];

const initialFormState = {
  name: '',
  email: '',
  role: 'athlete' as TestimonialRole,
  organization: '',
  testimonial: '',
  permission: false,
};

const PulseCheckTestimonialsPage: React.FC = () => {
  const [activeRole, setActiveRole] = useState<'all' | TestimonialRole>('all');
  const [form, setForm] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const visibleTestimonials = useMemo(() => {
    if (activeRole === 'all') return testimonials;
    return testimonials.filter((testimonial) => testimonial.role === activeRole);
  }, [activeRole]);

  const updateField = <Key extends keyof typeof initialFormState>(
    key: Key,
    value: (typeof initialFormState)[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitMessage(null);
    setSubmitError(null);

    if (!form.permission) {
      setSubmitError('Please confirm that PulseCheck may review and use your testimonial.');
      return;
    }

    if (form.testimonial.trim().length < 24) {
      setSubmitError('Please add a little more detail so the testimonial is useful.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/pulsecheck/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
          organization: form.organization,
          testimonial: form.testimonial,
          permission: form.permission,
          source: 'pulsecheck-testimonials-page',
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'We could not submit this testimonial yet.');
      }

      setForm(initialFormState);
      setSubmitMessage('Thank you. Your testimonial was received.');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'We could not submit this testimonial yet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="pc-testimonials">
      <PageHead
        metaData={pageMeta}
        pageOgUrl="https://pulsecheckmind.ai/testimonials"
        pageOgImage="/pulsecheck-pro-og-clean.png"
        themeColor="#08090d"
        appleItunesAppArgument="pulsecheck://home"
      />

      <header className="pct-nav">
        <a href="/PulseCheck" className="pct-brand" aria-label="PulseCheck home">
          <img src="/pulsecheck-youth/pulsecheck-wordmark.png" alt="PulseCheck" />
        </a>
        <a href="#submit" className="pct-nav-action">
          Submit a testimonial <ArrowRight size={16} />
        </a>
      </header>

      <section className="pct-hero">
        <img
          className="pct-hero-image"
          src="/pulsecheck-pro/hero-athletes.webp"
          alt="Competitive athletes preparing before a high pressure moment"
        />
        <div className="pct-hero-shade" aria-hidden="true" />
        <div className="pct-hero-copy">
          <p className="pct-kicker pct-kicker-light">PULSECHECK / TESTIMONIALS</p>
          <h1>
            PULSECHECK
            <span> TESTIMONIALS.</span>
          </h1>
          <p>
            Coaches, athletes, parents, and program leaders can share what PulseCheck changed in
            preparation, confidence, communication, and support.
          </p>
          <a href="#testimonials" className="pct-button pct-button-light">
            Read the stories <ArrowRight size={17} />
          </a>
        </div>
        <div className="pct-hero-note">
          <span>COACHES</span>
          <span>ATHLETES</span>
          <span>PARENTS</span>
          <span>ADMIN</span>
        </div>
      </section>

      <section className="pct-intro" aria-label="Testimonial review process">
        <div>
          <p className="pct-kicker">WHAT THIS PAGE COLLECTS</p>
          <h2>Real stories from the people using PulseCheck.</h2>
        </div>
        <p>
          We look for clear stories about what changed, who it helped, and why it matters. The best
          testimonials are specific, easy to understand, and honest about the moment PulseCheck
          helped.
        </p>
      </section>

      <section className="pct-proof" id="testimonials">
        <div className="pct-section-head">
          <p className="pct-kicker">VIEW TESTIMONIALS</p>
          <h2>Choose the voice you want to hear from.</h2>
        </div>

        <div className="pct-filter-row" role="tablist" aria-label="Filter testimonials by role">
          {roleFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={filter.id === activeRole ? 'is-active' : ''}
              onClick={() => setActiveRole(filter.id)}
              role="tab"
              aria-selected={filter.id === activeRole}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="pct-testimonial-grid">
          {visibleTestimonials.map((testimonial) => (
            <article className="pct-card" key={testimonial.id}>
              <div className="pct-card-top">
                <span>{testimonial.label}</span>
                <Quote size={20} aria-hidden="true" />
              </div>
              <p className="pct-quote">"{testimonial.quote}"</p>
              <div className="pct-card-meta">
                <strong>{testimonial.name}</strong>
                <span>{testimonial.context}</span>
              </div>
              <p className="pct-takeaway">{testimonial.takeaway}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pct-guide">
        <div className="pct-section-head">
          <p className="pct-kicker">WHAT MAKES A GOOD TESTIMONIAL</p>
          <h2>Say what changed.</h2>
        </div>
        <div className="pct-guide-grid">
          {roleNotes.map((note) => (
            <div className="pct-guide-item" key={note.title}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <h3>{note.title}</h3>
              <p>{note.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pct-submit" id="submit">
        <div className="pct-submit-copy">
          <p className="pct-kicker">SUBMIT A TESTIMONIAL</p>
          <h2>Tell us what PulseCheck helped you do.</h2>
          <p>
            Keep it simple. What was happening before PulseCheck, what changed, and what would you
            tell someone deciding whether to use it?
          </p>
        </div>

        <form className="pct-form" onSubmit={handleSubmit}>
          <div className="pct-field-row">
            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Your name"
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
          </div>

          <div className="pct-field-row">
            <label>
              I am a
              <select
                value={form.role}
                onChange={(event) => updateField('role', event.target.value as TestimonialRole)}
              >
                <option value="coach">Coach</option>
                <option value="athlete">Athlete</option>
                <option value="parent">Parent</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>
              Team, school, or organization
              <input
                type="text"
                value={form.organization}
                onChange={(event) => updateField('organization', event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <label>
            Your testimonial
            <textarea
              value={form.testimonial}
              onChange={(event) => updateField('testimonial', event.target.value)}
              placeholder="Tell us what changed, what helped, and why it mattered."
              rows={7}
              required
            />
          </label>

          <label className="pct-checkbox">
            <input
              type="checkbox"
              checked={form.permission}
              onChange={(event) => updateField('permission', event.target.checked)}
            />
            <span>
              PulseCheck may use this testimonial and contact me if more context is needed.
            </span>
          </label>

          {submitMessage && <p className="pct-form-message pct-form-message-good">{submitMessage}</p>}
          {submitError && <p className="pct-form-message pct-form-message-error">{submitError}</p>}

          <button className="pct-submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit testimonial'} <ArrowRight size={17} />
          </button>
        </form>
      </section>

      <footer className="pct-footer">
        <span>PULSECHECK / TESTIMONIALS</span>
        <a href="/PulseCheck">pulsecheckmind.ai</a>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');

        :root {
          --pct-black: #08090d;
          --pct-ink: #111217;
          --pct-paper: #f0ede4;
          --pct-paper-soft: #e5dfd1;
          --pct-white: #ffffff;
          --pct-purple: #7358ff;
          --pct-gold: #c6a777;
          --pct-muted: #6f6a60;
          --pct-line: rgba(17, 18, 23, 0.22);
          --pct-dark-line: rgba(255, 255, 255, 0.18);
        }

        html { scroll-behavior: smooth; }
        body { margin: 0; background: var(--pct-paper); }
        .pc-testimonials, .pc-testimonials * { box-sizing: border-box; }
        .pc-testimonials {
          min-height: 100vh;
          overflow: hidden;
          color: var(--pct-ink);
          background: var(--pct-paper);
          font-family: 'DM Sans', Arial, sans-serif;
        }
        .pc-testimonials a { color: inherit; }
        .pc-testimonials img { display: block; max-width: 100%; }

        .pct-nav {
          position: absolute;
          z-index: 20;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 89px;
          padding: 21px clamp(21px, 5vw, 89px);
          color: var(--pct-white);
          border-bottom: 1px solid rgba(255,255,255,.35);
        }
        .pct-brand { width: clamp(172px, 16vw, 242px); }
        .pct-brand img { width: 100%; filter: brightness(0) invert(1); }
        .pct-nav-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .pct-hero {
          position: relative;
          min-height: clamp(690px, 92svh, 900px);
          display: flex;
          align-items: flex-end;
          color: var(--pct-white);
          background: var(--pct-black);
        }
        .pct-hero-image,
        .pct-hero-shade {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .pct-hero-image {
          object-fit: cover;
          object-position: 60% 50%;
          filter: saturate(.72) contrast(1.08);
        }
        .pct-hero-shade {
          background:
            linear-gradient(90deg, rgba(8,9,13,.92) 0%, rgba(8,9,13,.68) 42%, rgba(8,9,13,.12) 74%),
            linear-gradient(0deg, rgba(8,9,13,.82) 0%, rgba(8,9,13,.1) 50%);
        }
        .pct-hero-copy {
          position: relative;
          z-index: 2;
          width: min(820px, calc(100% - 42px));
          margin-left: clamp(21px, 7vw, 110px);
          padding: 144px 0 clamp(89px, 12vh, 144px);
        }
        .pct-kicker {
          margin: 0 0 21px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0;
          text-transform: uppercase;
        }
        .pct-kicker-light { color: rgba(255,255,255,.76); }
        .pct-hero h1,
        .pct-intro h2,
        .pct-section-head h2,
        .pct-submit h2 {
          margin: 0;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-weight: 400;
          letter-spacing: 0;
          text-wrap: balance;
        }
        .pct-hero h1 {
          max-width: 780px;
          font-size: clamp(76px, 9vw, 150px);
          line-height: .82;
        }
        .pct-hero h1 span { display: block; }
        .pct-hero-copy p:not(.pct-kicker) {
          max-width: 620px;
          margin: 34px 0;
          color: rgba(255,255,255,.88);
          font-size: clamp(18px, 1.45vw, 23px);
          line-height: 1.45;
        }
        .pct-button,
        .pct-submit-button {
          width: fit-content;
          min-height: 55px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          padding: 0 25px;
          border: 1px solid currentColor;
          border-radius: 0;
          background: transparent;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background .2s ease, color .2s ease, transform .2s ease;
        }
        .pct-button:hover,
        .pct-submit-button:hover { transform: translateY(-2px); }
        .pct-button-light:hover { color: var(--pct-black); background: var(--pct-white); }
        .pct-hero-note {
          position: absolute;
          right: clamp(21px, 5vw, 89px);
          bottom: 34px;
          z-index: 2;
          display: flex;
          gap: 13px;
          color: rgba(255,255,255,.78);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0;
        }

        .pct-intro,
        .pct-proof,
        .pct-guide,
        .pct-submit {
          padding: clamp(55px, 8vw, 110px) clamp(21px, 5vw, 89px);
        }
        .pct-intro {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 520px);
          gap: clamp(34px, 6vw, 89px);
          align-items: end;
          border-bottom: 1px solid var(--pct-line);
        }
        .pct-intro h2,
        .pct-section-head h2,
        .pct-submit h2 {
          font-size: clamp(48px, 6vw, 96px);
          line-height: .9;
        }
        .pct-intro > p,
        .pct-submit-copy > p {
          margin: 0;
          color: var(--pct-muted);
          font-size: clamp(17px, 1.35vw, 21px);
          line-height: 1.55;
        }
        .pct-section-head {
          display: flex;
          justify-content: space-between;
          gap: 34px;
          align-items: end;
          margin-bottom: 34px;
        }
        .pct-section-head h2 { max-width: 760px; }

        .pct-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 34px;
        }
        .pct-filter-row button {
          min-height: 44px;
          padding: 0 18px;
          border: 1px solid var(--pct-line);
          border-radius: 0;
          background: transparent;
          color: var(--pct-ink);
          font: 700 12px/1 'DM Sans', Arial, sans-serif;
          letter-spacing: 0;
          text-transform: uppercase;
          cursor: pointer;
        }
        .pct-filter-row button.is-active {
          border-color: var(--pct-ink);
          background: var(--pct-ink);
          color: var(--pct-paper);
        }
        .pct-testimonial-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
        }
        .pct-card {
          min-height: 390px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 25px;
          border: 1px solid var(--pct-line);
          border-radius: 8px;
          background: rgba(255,255,255,.28);
        }
        .pct-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--pct-purple);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0;
          text-transform: uppercase;
        }
        .pct-quote {
          margin: 34px 0;
          color: var(--pct-ink);
          font-size: clamp(21px, 2vw, 30px);
          font-weight: 700;
          line-height: 1.12;
        }
        .pct-card-meta {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding-top: 21px;
          border-top: 1px solid var(--pct-line);
        }
        .pct-card-meta strong {
          color: var(--pct-ink);
          font-size: 14px;
        }
        .pct-card-meta span,
        .pct-takeaway {
          color: var(--pct-muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .pct-takeaway { margin: 18px 0 0; }

        .pct-guide {
          background: var(--pct-black);
          color: var(--pct-white);
        }
        .pct-guide .pct-kicker,
        .pct-guide p { color: rgba(255,255,255,.72); }
        .pct-guide-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1px;
          background: var(--pct-dark-line);
          border: 1px solid var(--pct-dark-line);
        }
        .pct-guide-item {
          min-height: 230px;
          padding: 25px;
          background: var(--pct-black);
        }
        .pct-guide-item svg { color: var(--pct-gold); }
        .pct-guide-item h3 {
          margin: 21px 0 13px;
          color: var(--pct-white);
          font-size: 20px;
        }
        .pct-guide-item p {
          margin: 0;
          font-size: 15px;
          line-height: 1.55;
        }

        .pct-submit {
          display: grid;
          grid-template-columns: minmax(280px, 440px) minmax(0, 1fr);
          gap: clamp(34px, 6vw, 89px);
          background: var(--pct-paper-soft);
        }
        .pct-submit-copy {
          position: sticky;
          top: 34px;
          align-self: start;
        }
        .pct-review-note {
          display: flex;
          gap: 13px;
          align-items: center;
          margin-top: 34px;
          padding-top: 21px;
          border-top: 1px solid var(--pct-line);
          color: var(--pct-muted);
          font-size: 14px;
          line-height: 1.35;
        }
        .pct-review-note svg { color: var(--pct-purple); flex: 0 0 auto; }
        .pct-form {
          display: grid;
          gap: 21px;
          padding: clamp(25px, 4vw, 55px);
          border: 1px solid var(--pct-line);
          border-radius: 8px;
          background: var(--pct-paper);
        }
        .pct-field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 21px;
        }
        .pct-form label {
          display: grid;
          gap: 8px;
          color: var(--pct-ink);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0;
          text-transform: uppercase;
        }
        .pct-form input,
        .pct-form select,
        .pct-form textarea {
          width: 100%;
          border: 1px solid var(--pct-line);
          border-radius: 0;
          background: rgba(255,255,255,.38);
          color: var(--pct-ink);
          font: 500 16px/1.4 'DM Sans', Arial, sans-serif;
          letter-spacing: 0;
          text-transform: none;
          outline: none;
        }
        .pct-form input,
        .pct-form select {
          min-height: 55px;
          padding: 0 16px;
        }
        .pct-form textarea {
          resize: vertical;
          padding: 16px;
        }
        .pct-form input:focus,
        .pct-form select:focus,
        .pct-form textarea:focus {
          border-color: var(--pct-purple);
          box-shadow: 0 0 0 3px rgba(115, 88, 255, .18);
        }
        .pct-checkbox {
          grid-template-columns: auto 1fr;
          align-items: start;
          letter-spacing: 0;
          text-transform: none;
          color: var(--pct-muted);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
        }
        .pct-checkbox input {
          width: 18px;
          height: 18px;
          min-height: 18px;
          margin-top: 1px;
          accent-color: var(--pct-purple);
        }
        .pct-form-message {
          margin: 0;
          padding: 13px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
        }
        .pct-form-message-good {
          border: 1px solid rgba(40, 126, 87, .35);
          background: rgba(40, 126, 87, .1);
          color: #245b43;
        }
        .pct-form-message-error {
          border: 1px solid rgba(152, 48, 48, .35);
          background: rgba(152, 48, 48, .1);
          color: #7a2a2a;
        }
        .pct-submit-button {
          border-color: var(--pct-ink);
          background: var(--pct-ink);
          color: var(--pct-paper);
        }
        .pct-submit-button:disabled {
          cursor: wait;
          opacity: .58;
          transform: none;
        }

        .pct-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 21px;
          padding: 25px clamp(21px, 5vw, 89px);
          color: rgba(255,255,255,.7);
          background: var(--pct-black);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0;
          text-transform: uppercase;
        }
        .pct-footer a { text-decoration: none; }

        @media (max-width: 1060px) {
          .pct-testimonial-grid,
          .pct-guide-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .pct-card { min-height: 330px; }
        }

        @media (max-width: 760px) {
          .pct-nav {
            min-height: 72px;
            padding: 18px 21px;
          }
          .pct-brand { width: 178px; }
          .pct-nav-action { font-size: 10px; }
          .pct-hero {
            min-height: 760px;
          }
          .pct-hero-image {
            object-position: 64% 50%;
          }
          .pct-hero-shade {
            background:
              linear-gradient(90deg, rgba(8,9,13,.95) 0%, rgba(8,9,13,.72) 62%, rgba(8,9,13,.3) 100%),
              linear-gradient(0deg, rgba(8,9,13,.86) 0%, rgba(8,9,13,.12) 52%);
          }
          .pct-hero-copy {
            width: calc(100% - 42px);
            margin-left: 21px;
            padding: 110px 0 89px;
          }
          .pct-hero h1 {
            font-size: clamp(65px, 18vw, 92px);
          }
          .pct-hero-note {
            left: 21px;
            right: 21px;
            justify-content: space-between;
            gap: 8px;
            font-size: 9px;
          }
          .pct-intro,
          .pct-submit {
            grid-template-columns: 1fr;
          }
          .pct-section-head {
            display: block;
          }
          .pct-testimonial-grid,
          .pct-guide-grid,
          .pct-field-row {
            grid-template-columns: 1fr;
          }
          .pct-card,
          .pct-guide-item {
            min-height: auto;
          }
          .pct-submit-copy {
            position: static;
          }
          .pct-footer {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .pct-button,
          .pct-submit-button {
            transition: none;
          }
          .pct-button:hover,
          .pct-submit-button:hover {
            transform: none;
          }
        }
      `}</style>
    </main>
  );
};

export default PulseCheckTestimonialsPage;

export const getStaticProps = async () => ({
  props: {
    ogMeta: {
      title: 'PulseCheck Testimonials',
      description:
        'Stories from coaches, athletes, parents, and program leaders using PulseCheck for mental performance.',
      image: 'https://pulsecheckmind.ai/pulsecheck-pro-og-clean.png',
      url: 'https://pulsecheckmind.ai/testimonials',
      type: 'website',
      siteName: 'PulseCheck',
    },
  },
});
