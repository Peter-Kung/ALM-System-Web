import { getDeploymentHandler } from "@/app/api/app/deployment/handler";

export async function GET() {
  return getDeploymentHandler();
}
