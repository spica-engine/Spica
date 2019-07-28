import {HttpClient, HttpHeaders, HttpRequest} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {select, Store} from "@ngrx/store";
import {PreferencesService} from "@spica-client/core";
import {fileToBuffer} from "@spica-client/core";
import * as BSON from "bson";
import {from, Observable} from "rxjs";
import {filter, flatMap, map, tap} from "rxjs/operators";
import {Storage} from "../../storage/interfaces/storage";
import {Bucket, BucketTemplate} from "../interfaces/bucket";
import {BucketSettings} from "../interfaces/bucket-settings";
import {PredefinedDefault} from "../interfaces/predefined-default";
import * as fromBucket from "./bucket.reducer";

@Injectable()
export class BucketService {
  constructor(
    private http: HttpClient,
    private store: Store<fromBucket.State>,
    private preference: PreferencesService
  ) {}

  getPreferences() {
    return this.preference.get<BucketSettings>("bucket");
  }

  retrieve() {
    return this.http
      .get<Bucket[]>(`api:/bucket`)
      .pipe(tap(buckets => this.store.dispatch(new fromBucket.Retrieve(buckets))));
  }

  getBuckets(): Observable<Bucket[]> {
    return this.store.pipe(select(fromBucket.selectAll));
  }

  getBucket(bucketId: string): Observable<Bucket> {
    return this.store.select(fromBucket.selectEntities).pipe(
      filter(entities => !!entities[bucketId]),
      map(entities => entities[bucketId])
    );
  }

  delete(id: string): Observable<any> {
    return this.http
      .delete(`api:/bucket/${id}`)
      .pipe(tap(() => this.store.dispatch(new fromBucket.Remove(id))));
  }

  replaceOne(bucket: Bucket): Observable<Bucket> {
    return this.http
      .post<Bucket>(`api:/bucket`, bucket)
      .pipe(tap(b => this.store.dispatch(new fromBucket.Upsert(b))));
  }

  updateMany(buckets: Bucket[]): Observable<Bucket[]> {
    return this.http.put<Bucket[]>(`api:/bucket`, buckets);
  }
  getPredefinedDefaults(): Observable<PredefinedDefault[]> {
    return this.http.get<PredefinedDefault[]>(`api:/bucket/predefs`);
  }

  importData(file: File, bucketId: string): Observable<any> {
    return from(fileToBuffer(file)).pipe(
      flatMap(content => {
        const data = BSON.serialize({
          content: {
            data: new BSON.Binary(content),
            type: file.type
          }
        });
        const request = new HttpRequest("POST", `api:/bucket/import/${bucketId}`, data.buffer, {
          reportProgress: true,
          headers: new HttpHeaders({"Content-Type": "application/bson"})
        });

        return this.http.request<Storage>(request);
      })
    );
  }

  importSchema(file: File): Observable<any> {
    return from(fileToBuffer(file)).pipe(
      flatMap(content => {
        const data = BSON.serialize({
          content: {
            data: new BSON.Binary(content),
            type: file.type
          }
        });
        const request = new HttpRequest("POST", `api:/bucket/import-schema`, data.buffer, {
          reportProgress: true,
          headers: new HttpHeaders({"Content-Type": "application/bson"})
        });

        return this.http.request<Storage>(request);
      })
    );
  }

  exportData(bucketIds: Array<string>): Observable<any> {
    return this.http.post(`api:/bucket/export`, bucketIds, {responseType: "blob"});
  }

  exportSchema(bucketId: string): Observable<any> {
    return this.http.post(`api:/bucket/export-schema`, bucketId, {responseType: "blob"});
  }
  getTemplates(): Observable<any> {
    return this.http.get<any>(`api:/bucket/templates`);
  }

  createFromTemplate(template: BucketTemplate): Observable<any> {
    return this.http.post(`api:/bucket/templates`, template).pipe(tap(data => console.log(data)));
  }
}
