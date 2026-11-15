import type { Metadata } from "next";
import { RolesAdmin } from "./RolesAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Role access", robots: { index: false, follow: false } };

export default function RolesAdminPage() {
  return <RolesAdmin />;
}
