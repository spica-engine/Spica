import {Factor, FactorMeta, FactorSchema, AuthFactorSchemaProvider} from "./interface";
import * as speakeasy from "speakeasy";
import * as qrcode from "qrcode";

export const TotpFactorSchemaProvider: AuthFactorSchemaProvider = () => {
  const schema: FactorSchema = {
    type: "totp",
    title: "Time based One Time Password",
    description: "Time base one time password by mobile app like Google Auth, Duo etc.",
    config: {}
  };
  return Promise.resolve(schema);
};

export interface TotpFactorMeta extends FactorMeta {
  type: "totp";
  secret: string;
}

export class Totp implements Factor {
  meta: TotpFactorMeta;
  name: string = "totp";

  constructor(meta: TotpFactorMeta) {
    this.meta = meta;
  }

  start() {
    if (this.meta.secret) {
      return Promise.resolve("Please enter the 6 digit code");
    }

    const secret = speakeasy.generateSecret({
      name: "Spica",
      issuer: "spica"
    });
    this.meta.secret = secret.base32;

    const qr = qrcode.toDataURL(secret.otpauth_url);
    return Promise.resolve(qr);
  }

  authenticate(payload: any) {
    if (!this.meta.secret) {
      return Promise.reject("No verified secret has been found.");
    }

    const isAuthenticated = speakeasy.totp.verify({
      secret: this.meta.secret,
      encoding: "base32",
      token: payload
    });

    return Promise.resolve(isAuthenticated);
  }

  getMeta() {
    return this.meta;
  }
}
