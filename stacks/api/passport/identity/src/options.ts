export const IDENTITY_OPTIONS = Symbol.for("IDENTITY_OPTIONS");

export interface IdentityOptions {
  expiresIn: number;
  maxExpiresIn: number;
  issuer: string;
  audience?: string;
  secretOrKey: string;
  defaultIdentityIdentifier?: string;
  defaultIdentityPassword?: string;
  defaultIdentityPolicies?: string[];
  entryLimit?: number;
}
