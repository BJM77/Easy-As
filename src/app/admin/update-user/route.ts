import { NextRequest, NextResponse } from "next/server";
import { updateUserAdmin } from "@/firebase/admin-user-updates";

export async function POST(req: NextRequest) {
  const { userId, payload } = await req.json();
  const result = await updateUserAdmin(userId, payload);
  return NextResponse.json(result);
}