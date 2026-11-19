"use client";
import {useEffect,useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {apiGet,apiPatch} from "@/lib/api";
import {formatCurrency} from "@/lib/format";
import type {CostLine} from "@/lib/order-cost-reconciliation";
type Reconciliation={status:string;quotedPrice:number;estimatedLines:CostLine[];actualLines:CostLine[]|null;estimatedCost:number;actualCost:number|null;estimatedProfit:number;actualProfit:number|null;reconciledAt:string|null};
const total=(lines:CostLine[])=>lines.reduce((n,x)=>n+x.amount,0);
export function OrderCostReconciliation({orderId,currency}:{orderId:string;currency:string}){
 const qc=useQueryClient();
 const {data,isLoading,error}=useQuery<Reconciliation>({queryKey:["order-cost-reconciliation",orderId],queryFn:()=>apiGet<Reconciliation>(`/api/orders/${orderId}/cost-reconciliation`)});
 const [lines,setLines]=useState<CostLine[]>([]);
 const [extraName,setExtraName]=useState("");
 useEffect(()=>{if(data)setLines((data.actualLines??data.estimatedLines).map(x=>({...x})));},[data]);
 const complete=data&&["Completed","Collected/Delivered"].includes(data.status);
 const save=useMutation({mutationFn:()=>apiPatch(`/api/orders/${orderId}/cost-reconciliation`,{actualLines:lines}),onSuccess:()=>{toast.success("Actual costs reconciled");qc.invalidateQueries({queryKey:["order-cost-reconciliation",orderId]});},onError:(e:Error)=>toast.error(e.message)});
 if(isLoading)return <p className="text-sm text-stone-500">Loading cost breakdown…</p>;
 if(error||!data)return <p className="text-sm text-amber-800">Original cost snapshot is not available for this order.</p>;
 const actual=total(lines),profit=data.quotedPrice-actual,margin=(p:number)=>data.quotedPrice>0?`${(p/data.quotedPrice*100).toFixed(1)}%`:"—";
 const baseline=new Map(data.estimatedLines.map(x=>[x.key,x.amount]));
 return <div className="space-y-5">
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
   {([["Estimated cost",data.estimatedCost],["Agreed quote",data.quotedPrice],["Actual cost",data.actualCost??actual],["Final profit",data.actualProfit??profit]] as [string,number][]).map(([label,value])=><div key={label} className="rounded-xl border border-[#EADDE0] bg-white p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(value,currency)}</p></div>)}
  </div>
  <p className="text-xs text-stone-500">The original estimate and agreed quote are locked. Change only actual costs that differed.</p>
  <div className="space-y-2">{lines.map((line,i)=>{const before=baseline.get(line.key)??0,delta=line.amount-before;return <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#EADDE0] p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
   <div><p className="text-sm font-medium">{line.label}</p><p className="text-xs text-stone-500">Estimate: {formatCurrency(before,currency)}{delta!==0&&<span className={delta>0?" text-red-700":" text-emerald-700"}> · {delta>0?"Over":"Under"} by {formatCurrency(Math.abs(delta),currency)}</span>}</p></div>
   <label className="text-xs text-stone-600">Actual ({currency})<input type="number" min="0" step="0.01" disabled={!complete||save.isPending} aria-label={`Actual cost: ${line.label}`} className="mt-1 block w-28 rounded-md border border-[#D2B9BF] p-2 text-right text-sm" value={line.amount} onChange={e=>setLines(old=>old.map((x,j)=>j===i?{...x,amount:Math.max(0,Number(e.target.value)||0)}:x))}/></label>
  </div>})}</div>
  {complete&&<div className="flex flex-wrap gap-2"><input aria-label="Forgotten expense" placeholder="Forgotten cost (e.g. extra zip)" className="min-w-48 flex-1 rounded-lg border border-[#D2B9BF] p-2 text-sm" value={extraName} onChange={e=>setExtraName(e.target.value)} maxLength={120}/><button className="rounded-lg border border-[#800020] px-4 py-2 text-sm text-[#800020]" onClick={()=>{if(!extraName.trim())return;setLines(old=>[...old,{key:`extra_${Date.now()}`,label:extraName.trim(),amount:0}]);setExtraName("");}}>Add forgotten cost</button></div>}
  <div className="rounded-xl bg-[#F8F1F2] p-4">
   <p className="text-sm">Estimated profit: <strong>{formatCurrency(data.estimatedProfit,currency)} ({margin(data.estimatedProfit)})</strong></p>
   <p className="mt-1 text-sm">Actual profit: <strong>{data.actualProfit===null?"Not reconciled":`${formatCurrency(data.actualProfit,currency)} (${margin(data.actualProfit)})`}</strong></p>
   {data.actualProfit!==null&&<p className="mt-3 text-lg font-semibold text-[#800020]">{data.actualProfit>=0?`You made ${formatCurrency(data.actualProfit,currency)} on this order.`:`You lost ${formatCurrency(Math.abs(data.actualProfit),currency)} on this order.`}</p>}
  </div>
  {complete?<button disabled={save.isPending} onClick={()=>save.mutate()} className="rounded-lg bg-[#800020] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{save.isPending?"Saving…":data.reconciledAt?"Update actual costs":"Confirm actual costs and calculate profit"}</button>:<p className="text-sm text-amber-800">Mark the order Completed or Collected/Delivered to reconcile actual costs.</p>}
 </div>;
}
