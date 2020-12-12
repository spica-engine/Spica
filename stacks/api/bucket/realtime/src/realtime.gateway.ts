import {OnGatewayConnection, WebSocketGateway} from "@nestjs/websockets";
import * as expression from "@spica-server/bucket/expression";
import {aggregate} from "@spica-server/bucket/expression";
import {BucketService, getBucketDataCollection} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {FindOptions, RealtimeDatabaseService, StreamChunk} from "@spica-server/database/realtime";
import {GuardService} from "@spica-server/passport";
import {fromEvent, Observable} from "rxjs";
import {takeUntil, tap} from "rxjs/operators";

@WebSocketGateway({
  path: "/bucket/:id/data"
})
export class RealtimeGateway implements OnGatewayConnection {
  streams = new Map<string, Observable<StreamChunk<any>>>();

  constructor(
    private realtime: RealtimeDatabaseService,
    private guardService: GuardService,
    private bucketService: BucketService
  ) {}

  async handleConnection(client: WebSocket, req) {
    req.headers.authorization = req.headers.authorization || req.query.get("Authorization");

    try {
      await this.guardService.checkAuthorization({
        request: req,
        response: client
      });
      await this.guardService.checkAction({
        request: req,
        response: client,
        actions: "bucket:data:stream",
        options: {resourceFilter: true}
      });
    } catch (e) {
      client.send(JSON.stringify({code: e.status || 500, message: e.message}));
      return client.close(1003);
    }

    const schemaId = req.params.id;

    const schema = await this.bucketService.findOne({_id: new ObjectId(schemaId)});

    const match = expression.aggregate(schema.acl.read, {auth: req.user});

    const options: FindOptions<{}> = {};

    if (req.query.has("filter")) {
      options.filter = {$and: [match, aggregate(req.query.get("filter"), {})]};
    } else {
      options.filter = match;
    }

    if (req.query.has("sort")) {
      options.sort = JSON.parse(req.query.get("sort"));
    }

    if (req.query.has("limit")) {
      options.limit = Number(req.query.get("limit"));
    }

    if (req.query.has("skip")) {
      options.skip = Number(req.query.get("skip"));
    }

    const cursorName = `${schemaId}_${JSON.stringify(options)}`;
    let stream = this.streams.get(cursorName);
    if (!stream) {
      stream = this.realtime.find(getBucketDataCollection(schemaId), options).pipe(
        tap({
          complete: () => this.streams.delete(cursorName)
        })
      );
      this.streams.set(cursorName, stream);
    }
    stream.pipe(takeUntil(fromEvent(client, "close"))).subscribe(data => {
      client.send(JSON.stringify(data));
    });
  }
}
