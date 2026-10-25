import { cadenceLabel } from './cadence';
const escape = (s:string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function coachEmail(kind:'baseline'|'check-in',link:string,manageLink:string,days=21) {
  for(const url of [link,manageLink]) if(new URL(url).protocol!=='https:') throw Error('Use HTTPS survey links.');
  const subject=kind==='baseline'?'Welcome to AthleticMind: your coach baseline':'Your AthleticMind coach check-in';
  const paragraphs=kind==='baseline'?["Please complete this short baseline questionnaire. It helps us understand how you currently support your athletes, what gets in the way, and what you’d like AthleticMind to help with."]:[`It’s time for your coach check-in. Thinking about the past ${cadenceLabel(days)}, tell us how useful AthleticMind has been and whether it has helped you decide to check in with an athlete or adjust your approach.`, 'There are two questions, plus space for any additional thoughts.'];
  const button=kind==='baseline'?'Complete your coach baseline':'Complete your coach check-in';
  const privacy=kind==='baseline'?'Please answer from your own experience and avoid including athlete names or private health information.':'Please avoid including athlete names or private health information.';
  const text=['Hi Coach,',...paragraphs,`${button}: ${link}`,privacy,'Thank you,\nThe AthleticMind Team',`Manage survey reminders: ${manageLink}`].join('\n\n');
  const html=`<div style="font-family:Arial,sans-serif;color:#202820;line-height:1.6;max-width:600px;margin:auto;padding:24px"><p>Hi Coach,</p>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}<p style="margin:28px 0"><a href="${escape(link)}" style="display:inline-block;background:#243d29;color:#fff;padding:14px 20px;border-radius:8px;font-weight:bold;text-decoration:none">${button}</a></p><p>${privacy}</p><p>Thank you,<br>The AthleticMind Team</p><p style="font-size:13px"><a href="${escape(manageLink)}" style="color:#243d29">Manage survey reminders</a></p></div>`;
  return {subject,text,html};
}
