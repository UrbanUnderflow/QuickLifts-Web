import React, { FormEvent, useState } from 'react';
import Head from 'next/head';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const UpdateListPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('submitting');
    setError('');

    try {
      const response = await fetch('/api/brevo/athleticmind-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent: consented }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'We couldn’t add you right now. Please try again.');
      }

      setState('success');
      setEmail('');
      setConsented(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  return (<>
<Head><title>Stay connected | AthleticMind</title><meta name="description" content="Get occasional AthleticMind updates on mental skills, athlete wellbeing, and ways to get involved. No donation required." /><meta name="theme-color" content="#F3EDE3" /><link rel="canonical" href="https://theathleticmind.ai/updatelist" /></Head>
<main className="updates"><div className="shell"><header className="top"><a className="wordmark" href="https://theathleticmind.ai" aria-label="AthleticMind home">AthleticMind</a></header>
<section className="hero">
<div><h1>Strong bodies.<br />Strong <em>minds.</em></h1>

<figure className="scene"><img src="https://theathleticmind.ai/brand-guide/images/s06-support.jpg" alt="Sculpted clay athlete talking with a clinician seated at equal eye level." /></figure></div>
<section className="signup" aria-label="Join the AthleticMind email list">{state === 'success' ? <div className="success" role="status" aria-live="polite"><p className="check" aria-hidden="true">✓</p><h2>You’re on the list.</h2><p className="copy">Thanks for joining. Unsubscribe anytime.</p></div> : <><h2>Stay connected.</h2><p className="copy">AthleticMind news and stories. No donation required.</p>
<form onSubmit={handleSubmit} aria-busy={state === 'submitting'}>
<label className="email-label" htmlFor="updates-email">Email address<input className="email-input" id="updates-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
<label className="consent"><input type="checkbox" required checked={consented} onChange={event => setConsented(event.target.checked)} /><span>Email me AthleticMind updates. Unsubscribe anytime. <a href="https://theathleticmind.ai/privacy">Privacy policy</a>.</span></label>
{state === 'error' && <p className="error" role="alert"><span aria-hidden="true">! </span>{error}</p>}
<button type="submit" disabled={state === 'submitting'}>{state === 'submitting' ? 'Adding you…' : 'Get updates'}</button></form></>}</section>
</section><footer className="partners"><nav className="partner-links" aria-label="Partner organizations"><a href="https://alfreedaarise.org" target="_blank" rel="noopener noreferrer">Alfreeda Goff Foundation ↗</a><a href="https://48andforward.org" target="_blank" rel="noopener noreferrer">48 &amp; Forward ↗</a></nav></footer></div></main><style jsx>{`
.updates{min-height:100vh;background:#F3EDE3;color:#193E33;font-family:Arial,Helvetica,sans-serif}
.updates *{box-sizing:border-box}
.shell{max-width:1280px;margin:auto;padding:0 48px}
.top{display:flex;align-items:center;justify-content:space-between;gap:32px;padding:32px 0;border-bottom:1px solid #827A6D55}
.wordmark{font:bold 28px Georgia,'Times New Roman',serif;letter-spacing:-1px;color:#000;text-decoration:none;padding:18px 0}
.back{font-size:14px;color:#193E33;text-underline-offset:5px;min-height:44px;display:flex;align-items:center}
.hero{display:grid;grid-template-columns:1.15fr 1fr;gap:64px;padding:56px 0 48px;align-items:center}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin:0 0 20px}
h1{font:800 clamp(42px,4.8vw,68px)/1.04 Arial,Helvetica,sans-serif;letter-spacing:-2.4px;margin:0 0 24px}
h1 em{font-family:Georgia,'Times New Roman',serif;font-weight:400}
.intro{font-size:18px;line-height:1.55;max-width:48ch;margin:0 0 28px}
.scene{margin:0;background:#193E33;border-radius:6px;overflow:hidden}
.scene img{display:block;width:100%;height:auto}
.scene figcaption{display:flex;justify-content:space-between;gap:16px;padding:18px 22px;color:#F3EDE3;font-size:13px;line-height:1.5}
.scene figcaption em{font-family:Georgia,serif;font-size:17px}
.signup{background:#fff;padding:36px;border:1px solid #827A6D44;border-radius:8px}
h2{font:bold 32px/1.15 Georgia,'Times New Roman',serif;letter-spacing:-.7px;margin:0 0 16px}
.copy{font-size:17px;line-height:1.55;margin:0 0 24px}
form{display:grid;gap:20px}
.email-label{font-size:14px;font-weight:700;display:grid;gap:10px}
.email-input{font:17px Arial,Helvetica,sans-serif;width:100%;min-height:54px;border:1px solid #827A6D;border-radius:4px;padding:14px;background:#fff;color:#193E33}
.email-input::placeholder{color:#54655e;opacity:1}
.consent{display:flex;align-items:flex-start;gap:12px;font-size:14px;line-height:1.55;min-height:44px;cursor:pointer}
.consent input{accent-color:#193E33;flex-shrink:0;width:18px;height:18px;margin:2px 0 0}
.consent a{color:#193E33;text-underline-offset:3px}
button{font:bold 16px Arial,Helvetica,sans-serif;background:#D4EE58;color:#193E33;min-height:54px;border:0;border-radius:4px;padding:15px 24px;cursor:pointer}
button:hover{box-shadow:inset 0 0 0 2px #193E33}
button:disabled{opacity:.65;cursor:wait}
.updates a:focus-visible,.updates input:focus-visible,.updates button:focus-visible{outline:3px solid #193E33;outline-offset:4px}
.small{font-size:13px;line-height:1.6;margin:18px 0 0}
.error{color:#6B2939;font-size:14px;line-height:1.5;margin:0}
.success{padding:24px 0}
.check{font-size:28px;margin:0 0 20px}
.partners{display:flex;align-items:center;gap:24px;border-top:1px solid #827A6D55;padding:28px 0 36px}
.partners .eyebrow{margin:0 0 8px}
.partners p{font-size:14px;line-height:1.5;margin:0}
.partner-links{display:flex;gap:24px;flex-wrap:wrap}
.partner-links a{font-size:15px;font-weight:700;color:#193E33;text-underline-offset:5px;min-height:44px;display:inline-flex;align-items:center}
@media(max-width:900px){.shell{padding:0 24px}.hero{gap:32px}.signup{padding:26px}h1{font-size:48px}.partners{grid-template-columns:1fr}}
@media(max-width:680px){.top{padding:16px 0;gap:16px}.wordmark{font-size:25px}.back{font-size:13px}.hero{grid-template-columns:1fr;padding:32px 0;gap:28px}h1{font-size:44px;letter-spacing:-1.7px}.intro{font-size:17px}.signup{padding:26px 22px}.scene figcaption{padding:14px 18px}.partner-links{gap:6px 24px}}
`}</style></>);
};
export default UpdateListPage;
