import { NextResponse } from "next/server";
import { getServices, createService } from "@/services/services.service";

export async function GET() {
  try {
    const services = await getServices();
    return NextResponse.json(services);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const service = await createService(body);
    return NextResponse.json(service);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
