import * as pb_1 from "google-protobuf";
import * as grpc_1 from "grpc";
export namespace Database {
  export class Change extends pb_1.Message {
    constructor(data?: any[]) {
      super();
      pb_1.Message.initialize(this, data, 0, -1, [], null);
    }
    get kind(): Change.Kind | undefined {
      return pb_1.Message.getFieldWithDefault(this, 1, undefined) as Change.Kind | undefined;
    }
    set kind(value: Change.Kind) {
      pb_1.Message.setField(this, 1, value);
    }
    get collection(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
    }
    set collection(value: string) {
      pb_1.Message.setField(this, 2, value);
    }
    get document(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 3, undefined) as string | undefined;
    }
    set document(value: string) {
      pb_1.Message.setField(this, 3, value);
    }
    get documentKey(): string | undefined {
      return pb_1.Message.getFieldWithDefault(this, 4, undefined) as string | undefined;
    }
    set documentKey(value: string) {
      pb_1.Message.setField(this, 4, value);
    }
    get updateDescription(): Change.UpdateDescription | undefined {
      return pb_1.Message.getWrapperField(this, Change.UpdateDescription, 5) as
        | Change.UpdateDescription
        | undefined;
    }
    set updateDescription(value: Change.UpdateDescription) {
      pb_1.Message.setWrapperField(this, 5, value);
    }
    toObject() {
      return {
        kind: this.kind,
        collection: this.collection,
        document: this.document,
        documentKey: this.documentKey,
        updateDescription: this.updateDescription
      };
    }
    serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
      const writer = w || new pb_1.BinaryWriter();
      if (this.kind != undefined) writer.writeEnum(1, this.kind);
      if (this.collection) writer.writeString(2, this.collection);
      if (this.document) writer.writeString(3, this.document);
      if (this.documentKey) writer.writeString(4, this.documentKey);
      if (this.updateDescription) writer.writeMessage(5, this.updateDescription, () => {});
      if (!w) return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Change {
      const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
        message = new Change();
      while (reader.nextField()) {
        if (reader.isEndGroup()) break;
        switch (reader.getFieldNumber()) {
          case 1:
            message.kind = reader.readEnum();
            break;
          case 2:
            message.collection = reader.readString();
            break;
          case 3:
            message.document = reader.readString();
            break;
          case 4:
            message.documentKey = reader.readString();
            break;
          case 5:
            reader.readMessage(
              message.updateDescription,
              () => (message.updateDescription = Change.UpdateDescription.deserialize(reader))
            );
            break;
          default:
            reader.skipField();
        }
      }
      return message;
    }
  }
  export namespace Change {
    export class UpdateDescription extends pb_1.Message {
      constructor(data?: any[]) {
        super();
        pb_1.Message.initialize(this, data, 0, -1, [], null);
      }
      get updatedFields(): string | undefined {
        return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
      }
      set updatedFields(value: string) {
        pb_1.Message.setField(this, 1, value);
      }
      get removedFields(): string | undefined {
        return pb_1.Message.getFieldWithDefault(this, 2, undefined) as string | undefined;
      }
      set removedFields(value: string) {
        pb_1.Message.setField(this, 2, value);
      }
      toObject() {
        return {
          updatedFields: this.updatedFields,
          removedFields: this.removedFields
        };
      }
      serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
        const writer = w || new pb_1.BinaryWriter();
        if (this.updatedFields) writer.writeString(1, this.updatedFields);
        if (this.removedFields) writer.writeString(2, this.removedFields);
        if (!w) return writer.getResultBuffer();
      }
      static deserialize(bytes: Uint8Array | pb_1.BinaryReader): UpdateDescription {
        const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
          message = new UpdateDescription();
        while (reader.nextField()) {
          if (reader.isEndGroup()) break;
          switch (reader.getFieldNumber()) {
            case 1:
              message.updatedFields = reader.readString();
              break;
            case 2:
              message.removedFields = reader.readString();
              break;
            default:
              reader.skipField();
          }
        }
        return message;
      }
    }
    export class Pop extends pb_1.Message {
      constructor(data?: any[]) {
        super();
        pb_1.Message.initialize(this, data, 0, -1, [], null);
      }
      get id(): string | undefined {
        return pb_1.Message.getFieldWithDefault(this, 1, undefined) as string | undefined;
      }
      set id(value: string) {
        pb_1.Message.setField(this, 1, value);
      }
      toObject() {
        return {
          id: this.id
        };
      }
      serialize(w?: pb_1.BinaryWriter): Uint8Array | undefined {
        const writer = w || new pb_1.BinaryWriter();
        if (this.id) writer.writeString(1, this.id);
        if (!w) return writer.getResultBuffer();
      }
      static deserialize(bytes: Uint8Array | pb_1.BinaryReader): Pop {
        const reader = bytes instanceof Uint8Array ? new pb_1.BinaryReader(bytes) : bytes,
          message = new Pop();
        while (reader.nextField()) {
          if (reader.isEndGroup()) break;
          switch (reader.getFieldNumber()) {
            case 1:
              message.id = reader.readString();
              break;
            default:
              reader.skipField();
          }
        }
        return message;
      }
    }
    export enum Kind {
      INSERT = 0,
      UPDATE = 1,
      REPLACE = 2,
      DELETE = 3
    }
  }
  export const Queue = {
    pop: {
      path: "/Database/Queue/pop",
      requestStream: false,
      responseStream: false,
      requestType: Database.Change.Pop,
      responseType: Database.Change,
      requestSerialize: (message: Change.Pop) => Buffer.from(message.serialize()),
      requestDeserialize: (bytes: Buffer) => Change.Pop.deserialize(new Uint8Array(bytes)),
      responseSerialize: (message: Change) => Buffer.from(message.serialize()),
      responseDeserialize: (bytes: Buffer) => Change.deserialize(new Uint8Array(bytes))
    }
  };
  export const QueueClient = grpc_1.makeGenericClientConstructor(Queue, "Queue", {});
}
