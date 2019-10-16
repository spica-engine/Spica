declare namespace triggers.firehose {
  export interface ClientAndPool {
    client: Client;
    pool: Pool;
  }
  export interface Pool {
    readonly size: number;
    send(event: string, data: any): void;
  }
  export interface Client {
    readonly remoteAddress: string;
    send(event: string, data: any): void;
    close(): void;
  }
  export interface Event<T = any> {
    name: string;
    data: T;
  }
  export interface ConnectionEvent {
    name: string;
    request: {
      url: string;
      headers: {
        [h: string]: string;
      };
    };
  }
}
