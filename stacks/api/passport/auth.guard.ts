import {
  CanActivate,
  ExecutionContext,
  Logger,
  mixin,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import * as passport from "passport";
import {Type, AuthModuleOptions} from "@nestjs/passport";
import {defaultOptions} from "@nestjs/passport/dist/options";
import {memoize} from "@nestjs/passport/dist/utils/memoize.util";

export type IAuthGuard = CanActivate & {
  logIn<TRequest extends {logIn: Function} = any>(request: TRequest): Promise<void>;
  handleRequest<TUser = any>(err, user, info, context): TUser;
};
export const AuthGuard: (type?: string) => Type<IAuthGuard> = memoize(createAuthGuard);

const NO_STRATEGY_ERROR = `In order to use "defaultStrategy", please, ensure to import PassportModule in each place where AuthGuard() is being used. Otherwise, passport won't work correctly.`;

function createAuthGuard(type?: string): Type<CanActivate> {
  class MixinAuthGuard<TUser = any> implements CanActivate {
    constructor(@Optional() protected readonly options?: AuthModuleOptions) {
      if (Array.isArray(this.options.defaultStrategy)) {
        throw "Default strategy can not be array.";
      } else {
        type = type || this.options.defaultStrategy;
      }
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const options = {...defaultOptions, ...this.options};
      const [request, response] = [this.getRequest(context), context.switchToHttp().getResponse()];
      const passportFn = createPassportContext(request, response);

      const parsedAuth = parseAuthHeader(request.headers.authorization);
      let strategyType;
      if (parsedAuth) {
        strategyType = parsedAuth.scheme;
      } else {
        strategyType = type;
      }

      const user = await passportFn(strategyType.toLowerCase(), options, (err, user, info) =>
        this.handleRequest(err, user, info, context)
      );
      request[options.property || defaultOptions.property] = user;
      return true;
    }

    getRequest<T = any>(context: ExecutionContext): T {
      return context.switchToHttp().getRequest();
    }

    async logIn<TRequest extends {logIn: Function} = any>(request: TRequest): Promise<void> {
      const user = request[this.options.property || defaultOptions.property];
      await new Promise((resolve, reject) =>
        request.logIn(user, err => (err ? reject(err) : resolve()))
      );
    }

    handleRequest(err, user, info, context): TUser {
      if (err || !user) {
        throw err || new UnauthorizedException();
      }
      return user;
    }
  }
  const guard = mixin(MixinAuthGuard);
  return guard;
}

const createPassportContext = (request, response) => (type, options, callback: Function) =>
  new Promise((resolve, reject) =>
    passport.authenticate(type, options, (err, user, info) => {
      try {
        request.authInfo = info;
        return resolve(callback(err, user, info));
      } catch (err) {
        reject(err);
      }
    })(request, response, err => (err ? reject(err) : resolve))
  );

function parseAuthHeader(hdrValue) {
  const re = /(\S+)\s+(\S+)/;
  if (typeof hdrValue !== "string") {
    return null;
  }
  const matches = hdrValue.match(re);
  return matches && {scheme: matches[1], value: matches[2]};
}
