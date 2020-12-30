import fetch from "node-fetch";

interface RequestInit {
  body?: BodyInit;
  headers?: HeadersInit;
}

export namespace http {
  export function get<T>(url: string | URL, requestInfo: RequestInit = {}) {
    const method = "get";
    return send(url, method, requestInfo).then(response => finalizeResponse<T>(response));
  }

  export function put<T>(url: string | URL, requestInfo: RequestInit = {}) {
    const method = "put";
    return send(url, method, requestInfo).then(response => finalizeResponse<T>(response));
  }

  export function post<T>(url: string | URL, requestInfo: RequestInit = {}) {
    const method = "post";
    return send(url, method, requestInfo).then(response => finalizeResponse<T>(response));
  }

  export function patch<T>(url: string | URL, requestInfo: RequestInit = {}) {
    const method = "patch";
    return send(url, method, requestInfo).then(response => finalizeResponse<T>(response));
  }

  export function del(url: string | URL, requestInfo: RequestInit = {}) {
    const method = "delete";
    return send(url, method, requestInfo).then(response => finalizeResponse<any>(response));
  }
}

function send(url: string | URL, method: string, requestInfo: RequestInit) {
  const request: any = {
    ...requestInfo,
    method: method
  };

  return fetch(url, request);
}

function finalizeResponse<T>(response: any) {
  logWarning(response);

  // parsing response that has 204 status is not possible
  if (response.status == 204) {
    return Promise.resolve(undefined);
  }

  return response.json().then(body => {
    if (!response.ok) {
      throw new Error(JSON.stringify(body));
    }
    return body as T;
  });
}

function logWarning(response: any) {
  const warning = response.headers.get("warning");
  if (warning) {
    console.warn(warning);
  }
}
