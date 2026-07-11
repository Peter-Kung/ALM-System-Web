import { healthHandler } from "@/app/api/health/handler";

export async function GET() {
  return healthHandler();
}
