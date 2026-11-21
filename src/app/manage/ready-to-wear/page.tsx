import { redirect } from "next/navigation";
import { getTenant } from "@/lib/db/session";
import ReadyToWearManager from "@/components/shop/ReadyToWearManager";
export default async function ManageReadyToWear(){const ctx=await getTenant();if(!ctx)redirect("/login");if(ctx.role!=="madam")return <p className="p-8">Only the studio owner can manage ready-to-wear products.</p>;return <ReadyToWearManager shopId={ctx.shopId}/>;}
