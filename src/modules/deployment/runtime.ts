export function deploymentControlsEnabled(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return environment.ALM_DISABLE_DEPLOYMENT_CONTROLS !== "1";
}
