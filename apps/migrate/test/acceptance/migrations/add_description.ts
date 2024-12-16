import {Context} from "@spica/migrate/src/migrate";

export default function(ctx: Context) {
  const coll = ctx.database.collection("_test_");
  return coll.updateOne({}, {$set: {description: "2.0.0"}});
}
