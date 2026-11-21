import { Suspense } from "react";
import ReadyToWearPaymentResult from "@/components/shop/ReadyToWearPaymentResult";
export default function PaymentPage(){return <Suspense fallback={<p className="p-8">Loading payment status…</p>}><ReadyToWearPaymentResult/></Suspense>}
