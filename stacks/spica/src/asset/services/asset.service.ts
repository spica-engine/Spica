import {HttpClient, HttpParams} from "@angular/common/http";
import {Inject, Injectable} from "@angular/core";
import {Store} from "@ngrx/store";
import {of} from "rxjs";
import {filter, switchMap, tap} from "rxjs/operators";
import {
  Asset,
  Config,
  AvailableResourcesByModule,
  ExportMeta,
  InstallationPreview,
  Status,
  ASSET_RESOURCE_LISTER,
  AvailableResource
} from "../interfaces";
import * as fromAsset from "../state/asset.reducer";

@Injectable()
export class AssetService {
  constructor(
    private http: HttpClient,
    private store: Store<fromAsset.State>,
    @Inject(ASSET_RESOURCE_LISTER)
    private _resourceListers: {name: string; list: () => Promise<AvailableResource[]>}[]
  ) {}

  find() {
    return this.store.select(fromAsset.selectAll);
  }

  findById(id: string) {
    return this.store.select(fromAsset.selectEntity(id));
  }

  install(id: string, configs: Config[], preview: boolean) {
    return this.http
      .post<any>(`api:/asset/${id}`, {configs}, {params: {preview: preview.toString()}})
      .pipe(tap(asset => !preview && this.store.dispatch(new fromAsset.Update(id, asset))));
  }

  remove(id: string, type: "hard" | "soft" = "soft") {
    return this.http.delete(`api:/asset/${id}`, {params: {type}}).pipe(
      switchMap(() => {
        if (type == "soft") {
          return this.http
            .get(`api:/asset/${id}`)
            .pipe(tap(asset => this.store.dispatch(new fromAsset.Update(id, asset))));
        } else {
          return of(this.store.dispatch(new fromAsset.Remove(id)));
        }
      })
    );
  }

  export(meta: ExportMeta) {
    return this.http.post("api:/asset/export", meta, {responseType: "blob"});
  }

  listResources() {
    const res: AvailableResourcesByModule = {};
    const promises = [];

    for (let lister of this._resourceListers) {
      const promise = lister.list().then(resources => (res[lister.name] = resources));
      promises.push(promise);
    }

    return Promise.all(promises).then(() => res);
  }

  retrieve() {
    return this.http
      .get<Asset[]>("api:/asset")
      .pipe(tap(assets => this.store.dispatch(new fromAsset.Retrieve(assets))));
  }
}
