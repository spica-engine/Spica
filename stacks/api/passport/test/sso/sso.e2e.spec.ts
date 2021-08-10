import {Controller, Get, INestApplication, Req, Res} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportModule} from "@spica-server/passport";
import {IdentityService} from "@spica-server/passport/identity";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

const EXPIRES_IN = 60_000;

const samlp = require("samlp");
const xpath = require("xpath");

const CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDVjCCAj4CCQCIeeA38VX/wjANBgkqhkiG9w0BAQUFADBtMQswCQYDVQQGEwJU
UjEMMAoGA1UECAwDYXNkMQwwCgYDVQQHDANxd2UxDjAMBgNVBAoMBXZjYmNiMQ0w
CwYDVQQLDARxcmVmMQwwCgYDVQQDDANjZ2IxFTATBgkqhkiG9w0BCQEWBnNhZGFz
ZDAeFw0yMTA4MTAxNTE1NDVaFw0yMjA4MTAxNTE1NDVaMG0xCzAJBgNVBAYTAlRS
MQwwCgYDVQQIDANhc2QxDDAKBgNVBAcMA3F3ZTEOMAwGA1UECgwFdmNiY2IxDTAL
BgNVBAsMBHFyZWYxDDAKBgNVBAMMA2NnYjEVMBMGCSqGSIb3DQEJARYGc2FkYXNk
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0jtjuwHvz0f2f1EMAeK2
q0Bs6eU/9WyogDXyelokjEB8t2/cbSI9Ejapn86+YagabMYsVYmfyCiWuD2sv114
UuKc27EDgiOYZ1sSuur0At4ujjQTjr3SDeM8HmkKUPIt/2o7ausVm2GnEIWnriFq
u939U+rjNa691pt6WwnfbWDaf42z07Cqsultj33+xP+f8bYwrZMvl4tWiH5c7CET
gC6Mk0XY3Qd5dCV2/kRGTONzEubtY0HfzqjGGaXKNinYTCpt2q2gJ34YJAtlWvpF
tXSQccyAVezzFLDWNXcYPMzeay1msvHa6Gy00vj5qMVpxr8wCAMebyEsYJ9hQvaR
9wIDAQABMA0GCSqGSIb3DQEBBQUAA4IBAQAObg/Ym59lWGuwomPUGjZx2nGtq9v1
8iK5eKDfhKDoMzZwrAwwmqOcy0yOPwVZPOMWO+u1XCs/NbP2BJm9Zrw5o8PQaq+q
onTtBEnEC3WN9YAZyFJIrn4vuC0H38bUO2Se07XXAu/Vt0GEZeSvu5yqs7IpHUsa
Hl0f4vg2d/35D9k0d2kGzVVfRNIXizkpkBkaHIy0Ewbnp72nVibJ1sCtpgG9pa3P
pIoqfJjCfF/ng+is6RY0LdvRAKr45Mq3BFmKCKJtTCeaEtB9axU9GY9D7I5ze8DU
JzFg3mfrtUNpzlvK1PsYI7qEmMA5OMSlrciyzqUTbrSOvG1TZdsncIBQ
-----END CERTIFICATE-----`;

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDSO2O7Ae/PR/Z/
UQwB4rarQGzp5T/1bKiANfJ6WiSMQHy3b9xtIj0SNqmfzr5hqBpsxixViZ/IKJa4
Pay/XXhS4pzbsQOCI5hnWxK66vQC3i6ONBOOvdIN4zweaQpQ8i3/ajtq6xWbYacQ
haeuIWq73f1T6uM1rr3Wm3pbCd9tYNp/jbPTsKqy6W2Pff7E/5/xtjCtky+Xi1aI
flzsIROALoyTRdjdB3l0JXb+REZM43MS5u1jQd/OqMYZpco2KdhMKm3araAnfhgk
C2Va+kW1dJBxzIBV7PMUsNY1dxg8zN5rLWay8drobLTS+PmoxWnGvzAIAx5vISxg
n2FC9pH3AgMBAAECggEBAJ+2NqHPatvSE9XNQI3+KkAXhaZ7XweYMLqWQUvqR3G1
XAoPlSnjpPm9RUf+zGtsRgb01qF1GEn7a+U0FZSb8dkmB3xvEfdAC3wZmDUgYZf8
KuolbeY3FukuBHIl4ox0L7WmgtVLGvMcUMsgfq6u/GMU1mt2On6B7f6nx2B6M57n
YRjlBROQqSFT1LMCgn43QPHBuboxscRSV9s0OT741bjCa53gcSBQ0qipX+Z7TePK
PyCtdg21Oc71L6D168pHxndHmyaPpBhEOljUCWyVHooDAOedQDeSijtyPF2zmj2H
81IujMR3L9jJA1vA7RAJiIrRjXuwhh65RrE8fptiVMECgYEA6UG7pkJmMNkYWxFX
5i9q/B8apm2zND+0bNQuSk1Xg4UJloF7XTP4w3N5bckkhnHWcc+y1HJOoXtxr0OG
mLLAoO695QtpVHqGi3A1asSCTyyoDxypHCq5CKJW9SlBB/r1VqRbdQkMC+1JAOup
jgEmGupLUvAtYz3VKBJ+boYey88CgYEA5rrwxTBEOFBCHqdpIyw0sr/Q5N54vBFq
tTq9WA8tKnP/HZkfc4hN8JdJFZGze1SU6yiGWioB3oWmsbJJKs6wb8kfrs6DEtlU
K75FkJ9R6w/1Zfw8VxVy9zAp1cb2KVfmNgLTWRSkR6DdlqHqPwogOGZi1RtM6Kun
g1X9U5wdmVkCgYEAr9VQWl11YV9Vv9iMFUYrdNERquHJFBrtrJgqKPKyhL814hHL
aA/0d4nFwJ++++Y2jGbQXNuqMIq4wTC69sLQ+L/fwBhhF0Chyd0VN13ZCUwViAbH
6CbAgyS1PmwRzK0+YkjVdJ0USq1duebsUtLE4cc6btQEsun6lBGU40YRUvsCgYBY
u8Qk0a8qyRLknxV8BWAu7j30Bur/yOL016ZB23RPQ1T1mRHTaLQwtr3QobwYziqH
VYp12nnljhjRdfNVly+bjgm1PI6EDTilqgMu31atw/FoS10ZUJJqJgeww1egBsHu
O5/0Pk//jAosCBECNW62wgl4U4t8X6eIhuVp5jwr4QKBgF7bSVCicw+YcT2RVTX8
L8zbxHMyoqGgYWRxwfMS7J526C/frNi7NhVtfCUnfzVSSAPXEKChmRKzbVHlr7Fd
1I0kOXRZvFN9h/5W6RCmN/UhynDkmUEdSbbjAajRlDuLK7/UYUzvsPoppQaUbD1+
vwjkmUIrTPIh/PepTqXqV4F8
-----END PRIVATE KEY-----`;

enum ClaimNamespaces {
  nameIdentifier = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  email = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  name = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  givenname = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
  surname = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
  upn = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
  groups = "http://schemas.xmlsoap.org/claims/Group"
}

@Controller("idp")
export class IDPController {
  constructor(private identity: IdentityService) {}

  @Get("login")
  async login(@Req() req, @Res() res) {
    const authorization = req.headers["authorization"] || "";

    req.user = await this.identity.verify(authorization);

    const claims = this.getClaims(req.user);

    // SAMLP only conforms with express like response objects.
    res.set = (k, v) => {
      res.headers.set(k, v);
    };

    samlp.auth({
      issuer: "spica",
      sessionIndex: -1,
      profileMapper: () => {
        return {
          getClaims: () => claims,
          getNameIdentifier: () => this.getNameIdentifier(claims)
        };
      },
      cert: "CERTIFICATE",
      key: "PRIVATE_KEY",
      getPostURL: function(wtrealm, wreply, req, callback) {
        // ATTENTION: If you get 401 error it might be related to this line since this logic does not work on latest version of xpath
        const callbackUrl = xpath.select(
          "string(//AuthnRequest/@AssertionConsumerServiceURL)",
          wreply
        );
        return callback(null, callbackUrl);
      },
      responseHandler: function(response, opts, req, res, next) {
        console.log(opts);
        const template = `
  <html>
  <head>
      <title>Working...</title>
      <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300&display=swap" rel="stylesheet">
      <style>
          body {
              width: 100vw;
              height: 100vh;
              margin: 0;
              background: url(https://storage.googleapis.com/hq-assets/background-landing.png);
              color: #fff;
              display:flex;
              flex-flow: column;
              justify-content: center;
              align-items: center;
              font-family: 'Ubuntu', sans-serif;
              font-size: 12px;
          }
          body > *:not(:first-child) {
              margin-top: 10px;
          }
          button {
              border: none;
              background: #f4f2f1;
              border-radius: 4px;
              padding: 8px 20px;
              margin-top: 15px;
          }
      </style>
  </head>
  <body>
      <img src="https://storage.googleapis.com/hq-assets/astro-composer.svg?v=1">
      <h1>A moment.</h1>
      <h3>We are trying to complete your request.</h3>
      <small>If you don't get redirected automatically within 2 seconds. Click to continue</small>
      <form method="post" action="${opts.postUrl}" enctype="application/x-www-form-urlencoded">
          <input type="hidden" name="SAMLResponse" value="${response.toString("base64")}">
          <input type="hidden" name="RelayState" value="${opts.RelayState ||
            (req.query || {}).RelayState ||
            (req.body || {}).RelayState ||
            ""}">
          <noscript>
              <p>Script is disabled. Click continue to continue.</p>
          </noscript>
          <button type="submit">Continue</button>
      </form>
      <script language="javascript" type="text/javascript">
          addEventListener("DOMContentLoaded", function(){
              setTimeout(function(){
                 document.forms[0].submit();
              }, 1000);
              setTimeout(function() {
                window.close();
              }, 2000);
          });
      </script>
  </body>
  </html>`;
        res.send(template.trim());
      }
    })(req, res, () => {});
  }

  getClaims(user) {
    return {
      [ClaimNamespaces.upn]: user.identifier,
      [ClaimNamespaces.nameIdentifier]: user.identifier,
      [ClaimNamespaces.email]: user.identifier,
      [ClaimNamespaces.name]: user.identifier,
      [ClaimNamespaces.givenname]: user.identifier,
      [ClaimNamespaces.surname]: user.identifier
    };
  }

  getNameIdentifier(claims) {
    return {
      nameIdentifier:
        claims[ClaimNamespaces.nameIdentifier] ||
        claims[ClaimNamespaces.name] ||
        claims[ClaimNamespaces.email]
    };
  }
}

describe("SSO E2E Test", () => {
  describe("SAML", () => {
    let req: Request;
    let app: INestApplication;
    let token: string;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        controllers: [IDPController],
        imports: [
          SchemaModule.forRoot(),
          DatabaseTestingModule.standalone(),
          PassportModule.forRoot({
            expiresIn: EXPIRES_IN,
            issuer: "spica",
            maxExpiresIn: EXPIRES_IN,
            publicUrl: "http://insteadof",
            samlCertificateTTL: EXPIRES_IN,
            secretOrKey: "spica",
            defaultStrategy: "IDENTITY",
            defaultIdentityIdentifier: "spica",
            defaultIdentityPassword: "spica",
            audience: "spica",
            defaultIdentityPolicies: ["PassportFullAccess"]
          }),
          PreferenceTestingModule,
          CoreTestingModule
        ]
      }).compile();

      jasmine.addCustomEqualityTester((actual, expected) => {
        if (expected == "__objectid__" && typeof actual == typeof expected) {
          return true;
        }
      });

      // const module = await Test.createTestingModule({
      //   providers: [
      //     SamlService,
      //     StrategyService,
      //     // {provide:PASSPORT_OPTIONS,useValue:{}},
      //   ],
      //   imports: [
      //     SchemaModule.forChild(),
      //     DatabaseTestingModule.standalone(),
      //     CoreTestingModule,
      //     PreferenceTestingModule,
      //     IdentityModule.forRoot({
      //       expiresIn: EXPIRES_IN,
      //       issuer: "spica",
      //       maxExpiresIn: EXPIRES_IN,
      //       secretOrKey: "spica"
      //     })
      //   ],
      //   controllers: [PassportController]
      // }).compile();

      // const module: any = await Test.createTestingModule({
      //   imports: [
      //     DatabaseTestingModule.standalone(),
      //     SSOTestingModule.initialize({
      //       expiresIn: EXPIRES_IN,
      //       issuer: "spica",
      //       maxExpiresIn: EXPIRES_IN,
      //       publicUrl: "http://unix",
      //       samlCertificateTTL: EXPIRES_IN,
      //       secretOrKey: "spica"
      //     }),
      //     CoreTestingModule
      //   ]
      // })
      //   .compile()
      //   .catch(console.log);

      req = module.get(Request);
      app = module.createNestApplication();

      await app.listen(req.socket);

      // WAIT UNTIL IDENTITY IS INSERTED
      await new Promise((resolve, _) => setTimeout(resolve, 3000));

      //LOGIN
      await req
        .post("/passport/identify", {
          identifier: "spica",
          password: "spica"
        })
        .then((res: any) => {
          token = res.body.token;
        });

      // STRATEGY INSERT
      const strategy = {
        type: "saml",
        name: "strategy1",
        title: "strategy1",
        options: {
          ip: {
            login_url: "/idp/login",
            logout_url: "/idp/logout",
            certificate: CERTIFICATE
          }
        }
      };
      await req.post("/passport/strategy", strategy, {Authorization: `IDENTITY ${token}`});
    }, 120000);

    it("should list strategies", async () => {
      const {body: strategies} = await req.get("/passport/strategies");
      expect(strategies).toEqual([
        {
          _id: "__objectid__",
          type: "saml",
          name: "strategy1",
          title: "strategy1",
          icon: "login"
        }
      ]);
    });

    it("should get strategy login url", async () => {
      const {body: strategies} = await req.get("/passport/strategies");
      const {body: strategy} = await req.get(`/passport/strategy/${strategies[0]._id}/url`);

      expect(strategy.state).toBeDefined();
      expect(strategy.url.startsWith("/idp/login?SAMLRequest=")).toBeTrue();
    });

    fit("should complete single sign on with success", async () => {
      const {body: strategies} = await req.get("/passport/strategies");
      const {body: strategy} = await req.get(`/passport/strategy/${strategies[0]._id}/url`);

      const samlReq = (strategy.url.substring(
        strategy.url.indexOf("?") + 1,
        strategy.url.length
      ) as string).split("=");
      const queryParams = {[samlReq[0]]: samlReq[1]};

      await req
        .get("/idp/login", queryParams, {Authorization: token})
        .catch(console.log);

      

        expect(1).toEqual(2);
    }, 10000);
  });
});
