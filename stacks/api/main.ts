import {Module} from "@nestjs/common";
import {NestFactory} from "@nestjs/core";
import {ActivityModule} from "@spica-server/activity";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {WsAdapter} from "@spica-server/core/websocket";
import {DashboardModule} from "@spica-server/dashboard";
import {DatabaseModule} from "@spica-server/database";
import {FunctionModule} from "@spica-server/function";
import {PassportModule} from "@spica-server/passport";
import {PreferenceModule} from "@spica-server/preference";
import {ApiMachineryModule} from "@spica-server/machinery";
import {StorageModule} from "@spica-server/storage";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as yargs from "yargs";

const args = yargs
  /* TLS Options */
  .options({
    "cert-file": {
      string: true,
      description: "Path to the client server TLS cert file."
    },
    "key-file": {
      string: true,
      description: "Path to the client server TLS key file."
    }
  })
  /* Database Options */
  .options({
    "database-uri": {
      string: true,
      description: "MongoDB connection url."
    },
    "database-name": {
      string: true,
      description: "Name of the database."
    },
    "database-replica-set": {
      string: true,
      alias: ["replica-set"],
      description: "Name of the replica set."
    },
    "database-pool-size": {
      number: true,
      description: "Amount of connection that will be opened against database.",
      default: 50
    }
  })
  .demandOption("database-name")
  .demandOption("database-uri")
  /* Feature Toggling: Bucket and Activity Stream */
  .options({
    "activity-stream": {
      boolean: true,
      description: "Whether Activity Stream feature is enabled.",
      default: true
    },
    "bucket-hooks": {
      boolean: true,
      description: "Whether Bucket Hooks feature is enabled.",
      default: true
    },
    "bucket-history": {
      boolean: true,
      description: "Whether Bucket History feature is enabled.",
      default: true
    },
    "experimental-bucket-realtime": {
      boolean: true,
      description: "Whether the experimental Bucket realtime feature is enabled.",
      default: true
    }
  })
  /* Passport Options  */
  .options({
    "passport-secret": {
      string: true,
      alias: ["secret"],
      description: "PEM-encoded public key (asymmetric) for verifying the JWT token's signature."
    },
    "passport-saml-certificate-ttl": {
      number: true,
      description: "Lifespan of the self-signed certificate in seconds.",
      default: Number.MAX_SAFE_INTEGER
    },
    "passport-identity-token-expires-in": {
      string: true,
      description: "Lifespan of the issued JWT tokens.",
      default: "2days"
    },
    "passport-default-identity-identifier": {
      string: true,
      description: "Identifier of the default identity.",
      default: "spica"
    },
    "passport-default-strategy": {
      string: true,
      description: "The default startegy to authenticate identities.",
      default: "IDENTITY",
      choices: ["IDENTITY", "APIKEY"]
    },
    "passport-default-identity-password": {
      string: true,
      description: "Password of the default account.",
      default: "spica"
    },
    "passport-default-identity-policies": {
      array: true,
      description: "Policies to attach to the default identity.",
      default: [
        "ApiKeyFullAccess",
        "IdentityFullAccess",
        "StrategyFullAccess",
        "PolicyFullAccess",
        "PassportFullAccess",
        "ActivityFullAccess",
        "StorageFullAccess",
        "FunctionFullAccess",
        "BucketFullAccess",
        "DashboardFullAccess",
        "WebhookFullAccess",
        "PreferenceFullAccess"
      ]
    }
  })
  .demandOption("passport-secret")
  /* Function Options */
  .options({
    "function-pool-size": {
      number: true,
      description: "Number of worker processes to fork at start up.",
      default: 10
    },
    "function-pool-maximum-size": {
      number: true,
      description: "Maximum number of worker processes to fork.",
      default: 15
    },
    "function-api-url": {
      string: true,
      description:
        "Internally or publicly accessible url of the api. This value will be used by various devkit packages such as @spica-devkit/bucket and @spica-devkit/dashboard. Defaults to value of --public-url if not present."
    },
    "function-timeout": {
      number: true,
      description: "Amount of time in seconds that has to elapse before aborting a function.",
      default: 120
    },
    "experimental-function-devkit-database-cache": {
      boolean: true,
      description: "When true, @spica-devkit/database will be cached and run significantly fast.",
      default: true
    }
  })
  /* Storage Options */
  .option({
    "storage-strategy": {
      string: true,
      description:
        "Cloud Storage service to store documents. Available options are default and gcloud.",
      default: "default",
      choices: ["default", "gcloud"]
    },
    "default-storage-path": {
      string: true,
      description:
        "A relative path to --persistent-path that will be used to store storage objects.",
      default: "storage"
    },
    "default-storage-public-url": {
      string: true,
      description:
        "Publicly accessible url of the storage. This value will be used by storage to generate urls to objects. Defaults to --public-url if not present."
    },
    "gcloud-service-account-path": {
      string: true,
      description: "Path for the service account file to authorize on google cloud services."
    },
    "gcloud-bucket-name": {
      string: true,
      description: "Name of the bucket to store documents on GCS."
    },
    "storage-object-size-limit": {
      number: true,
      description: "Maximum size in Mi that an object could be.",
      default: 35
    }
  })
  /* CORS Options */
  .option({
    "cors-allowed-origins": {
      array: true,
      description: "Access-Control-Allow-Origin.",
      default: ["*"]
    },
    "cors-allowed-methods": {
      array: true,
      description: "Access-Control-Allow-Methods",
      default: ["*"]
    },
    "cors-allowed-headers": {
      array: true,
      description: "Access-Control-Allow-Headers",
      default: ["Authorization", "Content-Type", "Accept-Language"]
    },
    "cors-allow-credentials": {
      boolean: true,
      description: "Access-Control-Allow-Credentials",
      default: true
    }
  })
  /* Common Options */
  .option("payload-size-limit", {
    number: true,
    description: "Maximum size in Mi that a body could be.",
    default: 15
  })
  .option("common-log-lifespan", {
    number: true,
    description: "Seconds that need to be passed to expire logs. Default value is one month.",
    default: 2629743
  })
  .option("port", {
    number: true,
    alias: ["p"],
    default: 80,
    description: "A port to listen on."
  })
  .option("persistent-path", {
    string: true,
    default: "/tmp",
    normalize: true,
    description: "A path that will be used by API to store persistent data."
  })
  .option("public-url", {
    string: true,
    description: "Publicly accessible url of the APIs.",
    alias: ["public-host"],
    describe: `This option will be used by various modules. 
For instance the 'storage' module will use this url to generate object links that are accessible from egress networks
While the 'passport' module will use this url to re-route the user to the Passport APIs.

Example: http(s)://doomed-d45f1.spica.io/api`
  })
  .demandOption("public-url")
  .check(args => {
    if (!args["default-storage-public-url"]) {
      args["default-storage-public-url"] = args["public-url"];
    }
    if (!args["function-api-url"]) {
      args["function-api-url"] = args["public-url"];
    }
    if (
      args["storage-strategy"] == "gcloud" &&
      (!args["gcloud-service-account-path"] || !args["gcloud-bucket-name"])
    ) {
      throw new TypeError(
        "--gcloud-service-account-path and --gcloud-bucket-name options must be present when --storage-strategy is set to 'gcloud'."
      );
    }
    if (args["storage-strategy"] == "default") {
      if (!args["default-storage-path"]) {
        throw new TypeError(
          "--default-storage-path options must be present when --storage-strategy is set to 'default'."
        );
      }
      if (path.isAbsolute(args["default-storage-path"])) {
        throw new TypeError("--default-storage-path must be relative.");
      }
    }
    return true;
  })
  .parserConfiguration({
    "duplicate-arguments-array": false
  })
  .env()
  .parse();

const modules = [
  DashboardModule,
  PreferenceModule,
  ApiMachineryModule.forRoot(),
  DatabaseModule.withConnection(args["database-uri"], {
    database: args["database-name"],
    replicaSet: args["database-replica-set"],
    poolSize: args["database-pool-size"],
    appname: "spica",
    useNewUrlParser: true,
    ["useUnifiedTopology" as any]: true
  }),
  SchemaModule.forRoot({
    formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
    defaults: [CREATED_AT, UPDATED_AT]
  }),
  BucketModule.forRoot({
    hooks: args["bucket-hooks"],
    history: args["bucket-history"],
    realtime: args["experimental-bucket-realtime"]
  }),
  StorageModule.forRoot({
    strategy: args["storage-strategy"] as "default" | "gcloud",
    defaultPath: path.join(args["persistent-path"], args["default-storage-path"]),
    defaultPublicUrl: args["default-storage-public-url"],
    gcloudServiceAccountPath: args["gcloud-service-account-path"],
    gcloudBucketName: args["gcloud-bucket-name"],
    objectSizeLimit: args["storage-object-size-limit"]
  }),
  PassportModule.forRoot({
    publicUrl: args["public-url"],
    secretOrKey: args["passport-secret"],
    issuer: args["public-url"],
    expiresIn: args["passport-identity-token-expires-in"],

    defaultStrategy: args["passport-default-strategy"],
    defaultIdentityPolicies: args["passport-default-identity-policies"],
    defaultIdentityIdentifier: args["passport-default-identity-identifier"],
    defaultIdentityPassword: args["passport-default-identity-password"],
    audience: "spica.io",
    samlCertificateTTL: args["passport-saml-certificate-ttl"]
  }),
  FunctionModule.forRoot({
    logExpireAfterSeconds: args["common-log-lifespan"],
    path: args["persistent-path"],
    databaseName: args["database-name"],
    databaseReplicaSet: args["database-replica-set"],
    databaseUri: args["database-uri"],
    poolSize: args["function-pool-size"],
    poolMaxSize: args["function-pool-maximum-size"],
    apiUrl: args["function-api-url"],
    timeout: args["function-timeout"],
    experimentalDevkitDatabaseCache: args["experimental-function-devkit-database-cache"],
    corsOptions: {
      allowedOrigins: args["cors-allowed-origins"],
      allowedMethods: args["cors-allowed-methods"],
      allowedHeaders: args["cors-allowed-headers"],
      allowCredentials: args["cors-allow-credentials"]
    }
  })
];

if (args["activity-stream"]) {
  modules.push(ActivityModule.forRoot({expireAfterSeconds: args["common-log-lifespan"]}));
}

@Module({
  imports: modules
})
class RootModule {}

let httpsOptions: https.ServerOptions;

if (args["cert-file"] && args["key-file"]) {
  httpsOptions = {
    key: fs.readFileSync(args["cert-file"]),
    cert: fs.readFileSync(args["key-file"])
  };
}

NestFactory.create(RootModule, {
  httpsOptions,
  bodyParser: false,
  logger: false
})
  .then(app => {
    app.useWebSocketAdapter(new WsAdapter(app));
    app.use(
      Middlewares.Preflight({
        allowedOrigins: args["cors-allowed-origins"],
        allowedMethods: args["cors-allowed-methods"],
        allowedHeaders: args["cors-allowed-headers"],
        allowCredentials: args["cors-allow-credentials"]
      }),
      Middlewares.JsonBodyParser({
        limit: args["payload-size-limit"],
        ignoreUrls: [/$\/storage/]
      }),
      Middlewares.MergePatchJsonParser(args["payload-size-limit"])
    );
    return app.listen(args.port);
  })
  .then(() => {
    console.log(`: APIs are ready on port ${args.port}`);
  });
