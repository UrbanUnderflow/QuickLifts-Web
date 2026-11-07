export type RecurringNotification={id:string;name:string;year:number;month:number;suggestions:number;reviews:number};
export type ExtraNotificationAction={id:string;title:string;description:string;count:number;onAction:()=>void;label:string};
const count=(value:number)=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
/** Counts represent actionable items, not section cards; zero category items never hide other work. */
export function notificationSummary(categoryCount:number,recurring:RecurringNotification[],extras:ExtraNotificationAction[]=[]){
 const recurringMap=new Map<string,RecurringNotification>();
 for(const item of recurring){if(!Number.isInteger(item.year)||!Number.isInteger(item.month)||item.month<1||item.month>12)continue;const normalized={...item,suggestions:count(item.suggestions),reviews:count(item.reviews)};if(normalized.suggestions+normalized.reviews)recurringMap.set(`${item.id}:${item.year}:${item.month}`,normalized);}
 const recurringItems=[...recurringMap.values()].sort((a,b)=>b.year-a.year||b.month-a.month||a.name.localeCompare(b.name));
 const extraMap=new Map<string,ExtraNotificationAction>();for(const item of extras)if(count(item.count))extraMap.set(item.id,{...item,count:count(item.count)});
 const extraItems=[...extraMap.values()];const categories=count(categoryCount),recurringCount=recurringItems.reduce((sum,item)=>sum+item.suggestions+item.reviews,0),extraCount=extraItems.reduce((sum,item)=>sum+item.count,0);
 return {total:categories+recurringCount+extraCount,categories,recurringCount,extraCount,recurringItems,extraItems};
}
