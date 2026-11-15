import type { Metadata } from "next";
import { TeamAdmin } from "./TeamAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin team", robots: { index: false, follow: false } };

export default function TeamAdminPage() {
  return <TeamAdmin />;
}
