import { type NextRequest } from "next/server";

import {
  createUserHandler,
  listUsersHandler,
} from "@/app/api/admin/users/handler";

export async function GET() {
  return listUsersHandler();
}

export async function POST(request: NextRequest) {
  return createUserHandler(request);
}
