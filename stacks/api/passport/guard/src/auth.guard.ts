import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  createParamDecorator,
  mixin,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import {AuthModuleOptions, Type} from "@nestjs/passport";
import {defaultOptions} from "@nestjs/passport/dist/options";
import {memoize} from "@nestjs/passport/dist/utils/memoize.util";
import * as passport from "passport";

export const StrategyType = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.strategyType;
});

export function isAValidStrategy(type: string) {
  return type.toLowerCase() in passport._strategies;
}

export const AuthGuard: (type?: string) => Type<CanActivate> = memoize(createAuthGuard);

export function createAuthGuard(type?: string): Type<CanActivate> {
  class MixinAuthGuard implements CanActivate {
    constructor(@Optional() private readonly options?: AuthModuleOptions) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest(),
        response = context.switchToHttp().getResponse();
      const options = {...defaultOptions, ...this.options};
      if (options) {
        if (Array.isArray(this.options.defaultStrategy)) {
          throw "Default strategy can not be an array.";
        } else {
          type = type || this.options.defaultStrategy || "NO_STRATEGY";
        }
      }

      const passportFn = createPassportContext(request, response);

      const desiredStrategy = parseAuthHeader(request.headers.authorization);

      let strategyType: string;
      if (desiredStrategy) {
        strategyType = desiredStrategy.scheme.toLocaleLowerCase();
      } else {
        strategyType = type.toLowerCase();
      }

      request.strategyType = strategyType.toUpperCase();

      const user = await passportFn(strategyType, options, (err: Error, user: unknown) => {
        if (err) {
          throw new BadRequestException(err.message);
        }
        if (!user) {
          throw new UnauthorizedException();
        }
        return user;
      });

      request[options.property] = user;

      return true;
    }
  }
  return mixin(MixinAuthGuard);
}

const createPassportContext = (request, response) => (type, options, callback: Function) =>
  new Promise((resolve, reject) =>
    passport.authenticate(type, options, (err, user, info) => {
      try {
        return resolve(callback(err, user, info));
      } catch (err) {
        reject(err);
      }
    })(request, response, err => (err ? resolve(callback(err)) : resolve))
  );

function parseAuthHeader(hdrValue) {
  const re = /(\S+)\s+(\S+)/;
  if (typeof hdrValue !== "string") {
    return null;
  }
  const matches = hdrValue.match(re);
  return matches && {scheme: matches[1], value: matches[2]};
}
