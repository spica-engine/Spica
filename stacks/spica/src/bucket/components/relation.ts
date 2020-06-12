import {InputSchema} from "@spica-client/common/input";

export interface RelationSchema extends InputSchema {
  bucketId: string;
  relationType: RelationType;
}

export enum RelationType {
  OneToOne = "onetoone",
  OneToMany = "onetomany"
}
