import { ARTISANS, createContact, listContacts } from "@/lib/db/contacts";

export async function GET() { return listContacts(ARTISANS); }
export async function POST(req: Request) { return createContact(ARTISANS, req); }
