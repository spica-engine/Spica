import {Injectable} from "@angular/core";
import {ApiKey, ApiKeyService} from "../interfaces/apikey";
import {of} from "rxjs";
import {ObjectId} from "bson";
import {IndexResult} from "@spica-server/core";
import {HttpClient} from "@angular/common/http";

@Injectable({providedIn: "root"})
export class MockService implements ApiKeyService {
  apiKeys: ApiKey[] = [];
  constructor() {}

  getAll(limit?: number, skip?: number) {
    this.apiKeys = JSON.parse(localStorage.getItem("apiKeys")) || [];
    if (limit || skip) {
      let copyApiKeys = JSON.parse(JSON.stringify(this.apiKeys));
      return of({
        meta: {total: this.apiKeys.length},
        data: copyApiKeys.slice(
          skip || 0,
          limit + skip <= copyApiKeys.length ? limit + skip : copyApiKeys.length
        )
      } as IndexResult<ApiKey>);
    } else {
      return of({meta: {total: this.apiKeys.length}, data: this.apiKeys} as IndexResult<ApiKey>);
    }
  }

  get(id: string) {
    return of(this.apiKeys.find(apiKey => apiKey._id == id));
  }

  update(apiKey: ApiKey) {
    this.apiKeys.map(val => {
      if (val._id == apiKey._id) val = apiKey;
    });
    localStorage.setItem("apiKeys", JSON.stringify(this.apiKeys));
    return of(apiKey);
  }

  insert(apiKey: ApiKey) {
    this.apiKeys.push({
      ...apiKey,
      key: new ObjectId().toHexString(),
      _id: new ObjectId().toHexString()
    });
    localStorage.setItem("apiKeys", JSON.stringify(this.apiKeys));
    return of(apiKey);
  }
}

@Injectable({providedIn: "root"})
export class apiKeyService implements ApiKeyService {
  constructor(private http: HttpClient) {}
  getAll(limit?: number, skip?: number) {
    return this.http.get<IndexResult<ApiKey>>("api:/passport/apikey", {
      params: {limit: limit.toString(), skip: skip.toString()}
    });
  }

  get(id: string) {
    return this.http.get<ApiKey>(`api:/passport/apikey/${id}`);
  }

  insert(apiKey: ApiKey) {
    return this.http.post<ApiKey>(`api:/passport/apikey`, apiKey);
  }

  update(apiKey: ApiKey) {
    return this.http.post<ApiKey>(`api:/passport/apikey/${apiKey._id}`, apiKey);
  }
}
