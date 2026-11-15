import { Suspense } from "react";
import { AdminPortalClient } from "./AdminPortalClient";
import { AdminQuickLinks } from "./AdminQuickLinks";

export const dynamic = "force-dynamic";

export default function AdminPortalPage() {
  return (
    <>
      <AdminQuickLinks />
      <Suspense fallback={null}>
        <AdminPortalClient />
      </Suspense>
    </>
  );
}
