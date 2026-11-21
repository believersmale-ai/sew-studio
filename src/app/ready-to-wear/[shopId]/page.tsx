import ReadyToWearStore from "@/components/shop/ReadyToWearStore";
export default async function ShopPage({params}:{params:Promise<{shopId:string}>}){const {shopId}=await params;return <ReadyToWearStore shopId={shopId}/>;}
