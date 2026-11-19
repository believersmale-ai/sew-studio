export type CostLine = {key:string;label:string;amount:number};
export const roundCost=(n:number)=>Math.round(n*100)/100;
export function validLines(input:unknown):CostLine[]|null{
 if(!Array.isArray(input)||input.length>100)return null;
 const keys=new Set<string>();
 const lines:CostLine[]=[];
 for(const item of input){
  if(!item||typeof item!=="object")return null;
  const key=String(item.key??"").slice(0,80),label=String(item.label??"").trim().slice(0,120),amount=Number(item.amount);
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(key)||keys.has(key)||!label||!Number.isFinite(amount)||amount<0||amount>100000000)return null;
  keys.add(key);lines.push({key,label,amount:roundCost(amount)});
 }
 return lines;
}
export const sumLines=(lines:CostLine[])=>roundCost(lines.reduce((n,x)=>n+x.amount,0));
