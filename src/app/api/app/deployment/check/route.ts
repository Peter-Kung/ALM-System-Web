import { checkDeploymentHandler } from "@/app/api/app/deployment/handler";

export async function POST() {
  return checkDeploymentHandler();
}
