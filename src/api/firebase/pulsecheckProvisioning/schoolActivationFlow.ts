/** Use persisted organization scope, never the installed app brand or caller flags. */
export const SCHOOL_ACTIVATION_FLOW_VERSION = 'school-activation-v1' as const;
export function resolveSchoolActivationFlow(input: { productBrand?: unknown; role?: unknown }): boolean {
  return input.productBrand === 'athleticmind' && input.role === 'athlete';
}
