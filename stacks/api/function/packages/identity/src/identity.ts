import {
  Identity,
  IdentityInitialization,
  ApikeyInitialization,
  IndexResult,
  LoginWithStrategyResponse,
  TokenScheme,
  ChallengeRes,
  Challenge,
  FactorSchema,
  FactorMeta
} from "./interface";
import {
  initialize as _initialize,
  checkInitialized,
  HttpService,
  Axios
} from "@spica-devkit/internal_common";
import {Strategy} from "./interface";
import {Observable} from "rxjs";

let authorization;

let service: HttpService;

const identitySegment = "passport/identity";

class _Challenge implements Challenge {
  constructor(private res: ChallengeRes, private answerResponseMapper: (res) => string = r => r) {}

  show() {
    return this.res.challenge;
  }

  answer(answer: string): Promise<string> {
    return service.post(this.res.answerUrl, {answer}).then(r => this.answerResponseMapper(r));
  }
}

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  const {authorization: _authorization, service: _service} = _initialize(options);

  authorization = _authorization;

  service = _service;

  service.setWriteDefaults({
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function verifyToken(token: string, baseUrl?: string) {
  const _baseUrl = baseUrl ? baseUrl : service ? service.baseUrl : undefined;

  if (!_baseUrl) {
    throw new Error("You should pass the base url of the server or call the initialize method.");
  }

  const req = new Axios({baseURL: _baseUrl});

  return req.get(`${identitySegment}/verify`, {headers: {Authorization: token}});
}

export async function login(
  identifier: string,
  password: string,
  tokenLifeSpan?: number
): Promise<string | Challenge> {
  checkInitialized(authorization);

  return service
    .post<TokenScheme | ChallengeRes>("/passport/identify", {
      identifier,
      password,
      expires: tokenLifeSpan
    })
    .then(r => {
      if (isTokenScheme(r)) {
        return r.token;
      }

      const challenge = new _Challenge(r, r => r.token);
      return challenge;
    });
}

// we don't want to export this function because it's for internal usages
function isTokenScheme(response: any): response is TokenScheme {
  return typeof response.token == "string";
}

export function isChallenge(tokenOrChallenge: any): tokenOrChallenge is Challenge {
  return typeof tokenOrChallenge.show == "function" && typeof tokenOrChallenge.answer == "function";
}

export async function loginWithStrategy(id: string): Promise<LoginWithStrategyResponse> {
  checkInitialized(authorization);

  const {url, state} = await service.get<{url: string; state: string}>(
    `/passport/strategy/${id}/url`
  );

  const token: Observable<string | Challenge> = new Observable(observer => {
    service
      .post<TokenScheme | ChallengeRes>("/passport/identify", {
        state
      })
      .then(r => {
        if (isTokenScheme(r)) {
          observer.next(r.token);
        } else {
          const challenge = new _Challenge(r, r => r.token);
          observer.next(challenge);
        }
        observer.complete();
      })
      .catch(e => observer.error(e));
  });

  return {
    url,
    token
  };
}

export namespace authfactor {
  export function list(): Promise<FactorSchema[]> {
    return service.get<FactorSchema[]>("passport/identity/factors");
  }

  export async function register(identityId: string, factor: FactorMeta): Promise<Challenge> {
    const response = await service.post<ChallengeRes>(
      `passport/identity/${identityId}/start-factor-verification`,
      factor
    );

    const challenge = new _Challenge(response, response => response.message);
    return challenge;
  }

  export function unregister(identityId: string) {
    return service.delete(`passport/identity/${identityId}/factors`);
  }
}

export function getStrategies() {
  return service.get<Strategy[]>("/passport/strategies");
}

export function get(id: string): Promise<Identity> {
  checkInitialized(authorization);

  return service.get<Identity>(`${identitySegment}/${id}`);
}

export function getAll(queryParams: object = {}): Promise<Identity[] | IndexResult<Identity>> {
  checkInitialized(authorization);

  return service.get<Identity[] | IndexResult<Identity>>(identitySegment, {
    params: queryParams
  });
}

export async function insert(identity: Identity): Promise<Identity> {
  checkInitialized(authorization);

  const insertedIdentity = await service.post<Identity>(identitySegment, identity);

  return policy.attach(insertedIdentity._id, identity.policies).then(policies => {
    insertedIdentity.policies = policies;
    return insertedIdentity;
  });
}

export function update(id: string, identity: Identity): Promise<Identity> {
  checkInitialized(authorization);

  return service.put<Identity>(`${identitySegment}/${id}`, identity);
}

export function remove(id: string): Promise<any> {
  checkInitialized(authorization);

  return service.delete(`${identitySegment}/${id}`);
}

// policy attach detach
export namespace policy {
  export function attach(identityId: string, policyIds: string[] = []): Promise<string[]> {
    checkInitialized(authorization);

    const promises: Promise<Identity>[] = [];
    const attachedPolicies = new Set<string>();

    for (const policyId of policyIds) {
      const promise = service
        .put<any>(`${identitySegment}/${identityId}/policy/${policyId}`, {})
        .then(() => attachedPolicies.add(policyId))
        .catch(e => {
          console.error(`Failed to attach policy with id ${policyId}: `, e);
          return e;
        });
      promises.push(promise);
    }

    return Promise.all(promises).then(() => Array.from(attachedPolicies));
  }

  export function detach(identityId: string, policyIds: string[] = []): Promise<string[]> {
    checkInitialized(authorization);

    const promises: Promise<Identity>[] = [];
    const detachedPolicies = new Set<string>();

    for (const policyId of policyIds) {
      const promise = service
        .delete(`${identitySegment}/${identityId}/policy/${policyId}`)
        .then(() => detachedPolicies.add(policyId))
        .catch(e => {
          console.error(`Failed to detach policy with id ${policyId}: `, e);
          return e;
        });
      promises.push(promise);
    }

    return Promise.all(promises).then(() => Array.from(detachedPolicies));
  }
}
