import { SUPPLIERS, createContact, listContacts } from "@/lib/db/contacts";

export async function GET() { return listContacts(SUPPLIERS); }
export async function POST(req: Request) { return createContact(SUPPLIERS, req); }
