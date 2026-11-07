export const recurringMerchantKey = (label:string) => label.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases=[
 {names:['claude','claude ai','anthropic'],key:'anthropic',review:true},
 {names:['chatgpt','chat gpt','openai','open ai'],key:'openai',review:true},
 {names:['gsuite','g suite','google workspace'],key:'google workspace',review:false},
 {names:['sendinblue','send in blue','brevo'],key:'brevo',review:false},
 {names:['dreamina'],key:'dreamina',review:false},
];
const includes=(text:string,key:string)=>` ${text} `.includes(` ${key} `);
export function recurringMatch(description:string,label:string) {
 const d=recurringMerchantKey(description),l=recurringMerchantKey(label);
 if(l.length>=4&&includes(d,l))return {matched:true,proposed:false,explanation:''};
 const group=aliases.find(group=>group.names.some(name=>includes(l,name)));
 if(group&&group.names.some(name=>includes(d,name)))return {matched:true,proposed:group.review,explanation:group.review?`${label} may be billed by ${group.key}. Confirm whether these charges are the subscription or other usage.`:`Merchant name variant recognized for ${group.key}.`};
 return {matched:false,proposed:false,explanation:''};
}
