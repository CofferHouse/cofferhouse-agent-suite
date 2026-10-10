// Public runtime summaries intentionally omit operator-only diagnostic lists.
// Keep their reported state while making them safe for the shared UI renderer.
export function deploymentView(deployment) {
  if (!deployment || typeof deployment.status !== "string") return null;
  return {
    ...deployment,
    required: Array.isArray(deployment.required) ? deployment.required : [],
    recommended: Array.isArray(deployment.recommended) ? deployment.recommended : []
  };
}
