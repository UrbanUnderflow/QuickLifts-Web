const rawKey=(label:string)=>label.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const includes=(text:string,key:string)=>` ${text} `.includes(` ${key} `);
const billProviders=[
 {names:['pnc mortgage','pnc mtg'],key:'pnc mortgage',label:'PNC Mortgage'},
 {names:['tmobile','t mobile'],key:'t mobile',label:'T-Mobile'},
 {names:['at t','att payment','att autopay'],key:'at t',label:'AT&T'},
 {names:['georgia power'],key:'georgia power',label:'Georgia Power'},
 {names:['scana','igs energy'],key:'scana',label:'SCANA / IGS Energy'},
 {names:['dte energy'],key:'dte energy',label:'DTE Energy'},
 {names:['verizon'],key:'verizon',label:'Verizon'},
 {names:['comcast','xfinity'],key:'comcast xfinity',label:'Comcast / Xfinity'},
 {names:['duke energy'],key:'duke energy',label:'Duke Energy'},
 {names:['dominion energy'],key:'dominion energy',label:'Dominion Energy'},
];
const feeDescription=(label:string)=>/\b(overdraft|late fee|late payment fee|returned payment|insufficient funds|nsf|finance charge|interest charge)\b/i.test(label);
/** Only recognized billers get broad amount/multiple-charge treatment, never generic shopping merchants. */
export function recurringBillIdentity(label:string){
 if(feeDescription(label))return null;
 const key=rawKey(label);const provider=billProviders.find(provider=>provider.names.some(name=>includes(key,name)));
 return provider?{key:provider.key,label:provider.label}:null;
}
export const recurringMerchantKey=(label:string)=>recurringBillIdentity(label)?.key||rawKey(label);
const aliases=[
 {names:['claude','claude ai','anthropic'],key:'anthropic',review:true},
 {names:['chatgpt','chat gpt','openai','open ai'],key:'openai',review:true},
 {names:['gsuite','g suite','google workspace'],key:'google workspace',review:false},
 {names:['sendinblue','send in blue','brevo'],key:'brevo',review:false},
 {names:['dreamina'],key:'dreamina',review:false},
];
export function recurringMatch(description:string,label:string) {
 const bill=recurringBillIdentity(label),candidate=recurringBillIdentity(description);
 // A fee mentioning the biller is not the bill itself.
 if(bill&&feeDescription(description))return {matched:false,proposed:false,explanation:''};
 if(bill&&candidate?.key===bill.key)return {matched:true,proposed:false,explanation:`Recognized ${bill.label} billing description; the selected month's actual charges determine the amount.`};
 const d=recurringMerchantKey(description),l=recurringMerchantKey(label);
 if(l.length>=4&&includes(d,l))return {matched:true,proposed:false,explanation:''};
 const group=aliases.find(group=>group.names.some(name=>includes(l,name)));
 if(group&&group.names.some(name=>includes(d,name)))return {matched:true,proposed:group.review,explanation:group.review?`${label} may be billed by ${group.key}. Confirm whether these charges are the subscription or other usage.`:`Merchant name variant recognized for ${group.key}.`};
 return {matched:false,proposed:false,explanation:''};
}
