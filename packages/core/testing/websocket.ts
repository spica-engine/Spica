import {Inject, Injectable} from "@nestjs/common";
import * as CL from "ws";
import * as url from "url";

export type WebsocketOptions = CL.ClientOptions;

@Injectable()
export class Websocket {
  constructor(@Inject("SOCKET") readonly socket: string) {}

  get(path: string, options?: WebsocketOptions): Client {
    const url = new URL(`ws+unix://${this.socket}:${path}`);
    url.search = "";
    Object.defineProperty(url, "pathname", {value: `${this.socket}:${path}`});
    return new Client(url as any, options);
  }
}

export class Client extends CL {
  get connect() {
    return new Promise(resolve => this.once("open", (...args) => setTimeout(resolve, 2, args)));
  }

  close() {
    super.close();
    return new Promise(resolve => this.once("close", (...args) => setTimeout(resolve, 2, args)));
  }

  send(data: any) {
    return new Promise((resolve, reject) =>
      super.send(data, err => {
        if (err) {
          return reject(err);
        }
        setTimeout(resolve, 1);
      })
    );
  }
}
