import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, heading } from "@/components/site/SiteShell";
import { getPool } from "@/lib/db/pool";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Ready-to-Wear | Sewsiness",description:"Discover ready-made garments from Sewsiness studios. Browse collections and order directly from the studio."};
type Studio={id:string;name:string;slug:string|null;items:number;preview:string|null};
export default async function ReadyToWearLanding(){
 let studios:Studio[]=[];let unavailable=false;
 try{
  const {rows}=await getPool().query(`select s.id,s.name,s.slug,count(distinct p.id)::integer as items,(array_agg(p.image_url order by p.created_at desc) filter(where p.image_url is not null))[1] as preview
    from public.shops s join public.rtw_products p on p.shop_id=s.id
    where p.published=true and exists(select 1 from public.rtw_variants v where v.product_id=p.id and v.stock>0)
    group by s.id,s.name,s.slug order by s.name asc limit 60`);
  studios=rows;
 }catch(e){unavailable=true;console.error("[rtw] website collection listing failed",e)}
 return <SiteShell><section className="bg-[#2b0813] px-5 py-16 text-center text-white sm:py-24"><p className="text-xs font-bold uppercase tracking-[.25em] text-[#e6c58d]">Sewsiness collections</p><h1 className={`${heading} mx-auto mt-4 max-w-3xl text-5xl font-semibold sm:text-7xl`}>Ready to wear, ready to love.</h1><p className="mx-auto mt-5 max-w-xl text-base leading-8 text-white/75">Explore beautiful ready-made garments from independent fashion studios. Choose your favourite collection and order directly from its designer.</p></section><section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><h2 className={`${heading} text-4xl font-semibold text-[#35121d]`}>Explore studio collections</h2><p className="mt-2 text-sm text-[#765d63]">Each collection is managed and fulfilled by its studio.</p></div><Link href="/ready-to-wear/track" className="rounded-full border border-[#800020] px-5 py-3 text-sm font-semibold text-[#800020]">Track an order</Link></div>{unavailable?<p role="status" className="rounded-xl border p-5">Collections are temporarily unavailable. Please try again later.</p>:studios.length===0?<div className="rounded-2xl border border-[#eadde0] bg-white p-12 text-center"><h3 className="font-serif text-2xl">Collections are coming soon</h3><p className="mt-3 text-sm text-[#765d63]">Designers are preparing their first ready-to-wear pieces.</p></div>:<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{studios.map(s=><article key={s.id} className="overflow-hidden rounded-2xl border border-[#eadde0] bg-white shadow-sm">{s.preview?<img src={s.preview} alt={`${s.name} collection`} className="aspect-[4/3] w-full object-cover"/>:<div className="grid aspect-[4/3] place-items-center bg-[#f3e8e8] text-[#800020]">Sewsiness atelier</div>}<div className="p-5"><h3 className="font-serif text-2xl font-semibold">{s.name}</h3><p className="mt-2 text-sm text-[#765d63]">{s.items} available styles</p><Link href={`/ready-to-wear/${s.id}`} className="mt-5 inline-flex rounded-full bg-[#800020] px-5 py-3 text-sm font-bold text-white">Explore collection</Link></div></article>)}</div>}</section></SiteShell>
}
