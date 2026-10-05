export type ProductBrand = 'athleticmind' | 'pulsecheck';
export type EscalationModel = 'aunt-edna' | '988';
export interface ProductConfiguration { brand: ProductBrand; displayName: string; escalationModel: EscalationModel }
export interface OrganizationProductConfiguration { productBrand?: ProductBrand | string | null; appBranding?: Partial<Record<ProductBrand, ProductBrand>> | null }
export const PRODUCTS: Readonly<Record<ProductBrand, Readonly<ProductConfiguration>>>;
export function normalizeProductBrand(value: unknown): ProductBrand;
export function resolveProductConfig(organization?: OrganizationProductConfiguration | null): Readonly<ProductConfiguration>;
export function resolveAppBranding(organization: OrganizationProductConfiguration | null | undefined, appIdentity: ProductBrand): Readonly<Pick<ProductConfiguration, 'brand' | 'displayName'>>;

export function validateProductBrand(value: unknown): ProductBrand;
export function normalizeAppBranding(value: unknown): Partial<Record<ProductBrand, ProductBrand>>;
