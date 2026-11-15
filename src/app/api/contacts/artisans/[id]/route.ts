import { ARTISANS, deleteContact, updateContact } from "@/lib/db/contacts";

type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: Request, { params }: Ctx) { return updateContact(ARTISANS, req, (await params).id); }
export async function DELETE(_req: Request, { params }: Ctx) { return deleteContact(ARTISANS, (await params).id); }
