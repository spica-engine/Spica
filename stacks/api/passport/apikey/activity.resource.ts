import {Resource, Action} from "@spica-server/activity";

export function createApikeyResource(action: Action, req: any, res: any): Resource {
  let name = "Apikey";

  let documentId: string[] = [];
  switch (action) {
    case Action.POST:
      documentId.push(res._id.toString());
      break;
    case Action.PUT:
      documentId.push(req.params.id);
      break;
    case Action.DELETE:
      documentId.push(req.params.id);
      break;
  }

  return {name, documentId};
}
