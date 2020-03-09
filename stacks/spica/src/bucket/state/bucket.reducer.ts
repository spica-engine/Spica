import {createEntityAdapter, EntityState} from "@ngrx/entity";
import {Action, createFeatureSelector, createSelector} from "@ngrx/store";
import {Bucket} from "../interfaces/bucket";

export enum BucketActionTypes {
  RETRIEVE = "BUCKET_RETRIEVE",
  ADD = "BUCKET_ADD",
  REMOVE = "BUCKET_REMOVE",
  UPDATE = "BUCKET_UPDATE",
  UPSERT = "BUCKET_UPSERT"
}

export class Add implements Action {
  readonly type = BucketActionTypes.ADD;
  constructor(public bucket: Bucket) {}
}

export class Update implements Action {
  readonly type = BucketActionTypes.UPDATE;
  constructor(public id: string, public changes: Partial<Bucket>) {}
}

export class Upsert implements Action {
  readonly type = BucketActionTypes.UPSERT;
  constructor(public bucket: Bucket) {}
}

export class Remove implements Action {
  readonly type = BucketActionTypes.REMOVE;
  constructor(public id: string) {}
}

export class Retrieve implements Action {
  readonly type = BucketActionTypes.RETRIEVE;
  constructor(public buckets: Bucket[]) {}
}

export type BucketAction = Retrieve | Add | Update | Remove | Upsert;

export interface State extends EntityState<Bucket> {
  loaded: boolean;
}

export const adapter = createEntityAdapter<Bucket>({
  selectId: bucket => bucket._id,
  sortComparer: (a, b) => a.order - b.order
});

export const initialState: State = adapter.getInitialState({loaded: false});

export function reducer(state: State = initialState, action: BucketAction): State {
  switch (action.type) {
    case BucketActionTypes.RETRIEVE:
      return adapter.addAll(action.buckets, {...state, loaded: true});
    case BucketActionTypes.ADD:
      return adapter.addOne(action.bucket, state);
    case BucketActionTypes.REMOVE:
      return adapter.removeOne(action.id, state);
    case BucketActionTypes.UPDATE:
      return adapter.updateOne({id: action.id, changes: action.changes}, state);
    case BucketActionTypes.UPSERT:
      return adapter.upsertOne(action.bucket, state);
    default:
      return state;
  }
}

export const bucketFeatureSelector = createFeatureSelector<State>("bucket");

export const {selectIds, selectEntities, selectAll, selectTotal} = adapter.getSelectors(
  bucketFeatureSelector
);

export const selectLoaded = createSelector(
  bucketFeatureSelector,
  state => state.loaded
);

export const selectEmpty = createSelector(
  bucketFeatureSelector,
  selectTotal,
  (state, total) => state.loaded && total == 0
);
