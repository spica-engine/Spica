import {Bucket, BucketService, getBucketDataCollection} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {buildI18nAggregation, Locale} from "./locale";
import {deepCopy} from "./patch";

export function findRelations(
  schema: any,
  bucketId: string,
  path: string = "",
  targets: Map<string, RelationType>
) {
  path = path ? `${path}.` : ``;
  for (const field of Object.keys(schema)) {
    if (isObject(schema[field])) {
      findRelations(schema[field].properties, bucketId, `${path}${field}`, targets);
    } else if (isDesiredRelation(schema[field], bucketId)) {
      targets.set(`${path}${field}`, schema[field].relationType);
    }
  }
  return targets;
}

export function getRelationPaths(target: Bucket | string[]) {
  if (Array.isArray(target)) {
    return target.map(pattern => pattern.split(".").concat(["_id"]));
  }

  const relationPaths = [];
  for (const propertyKey in target.properties) {
    if (target.properties[propertyKey].type != "relation") {
      continue;
    }
    relationPaths.push([propertyKey, "_id"]);
  }
  return relationPaths;
}

export function getRelationPipeline(map: RelationMap[], locale: Locale): object[] {
  const pipeline = [];

  for (const relation of map) {
    let subPipeline;

    if (relation.children) {
      subPipeline = getRelationPipeline(relation.children, locale);
    }

    const stage = buildRelationAggregation(
      relation.path,
      relation.target,
      relation.type,
      locale,
      subPipeline
    );

    pipeline.push(...stage);
  }

  return pipeline;
}

export const enum RelationType {
  One = "onetoone",
  Many = "onetomany"
}

export interface RelationMap {
  type: RelationType;
  target: string;
  path: string;
  children?: RelationMap[];
}

interface RelationMapOptions {
  resolve: (id: string) => Promise<Bucket>;
  paths: string[][];
  properties: object;
}

export async function createRelationMap(options: RelationMapOptions): Promise<RelationMap[]> {
  const visit = async (
    properties: object,
    paths: string[][],
    depth: number
  ): Promise<RelationMap[]> => {
    const maps: RelationMap[] = [];

    for (const [propertyKey, propertySpec] of Object.entries(properties)) {
      if (propertySpec.type != "relation") {
        continue;
      }

      const matchingPaths = paths.filter(
        segments =>
          segments[depth] == propertyKey &&
          // if child field of this document requested
          segments.length > depth + 1
      );

      if (!matchingPaths.length) {
        continue;
      }

      const schema = await options.resolve(propertySpec.bucketId);

      const children = await visit(schema.properties, matchingPaths, depth + 1);

      maps.push({
        path: propertyKey,
        target: propertySpec.bucketId,
        type: propertySpec.relationType,
        children: children.length ? children : undefined
      });
    }

    return maps;
  };

  return visit(options.properties, options.paths, 0);
}

interface ResetNonOverlappingPathsOptions {
  left: string[][];
  right: string[][];
  map: RelationMap[];
}

export function resetNonOverlappingPathsInRelationMap(
  options: ResetNonOverlappingPathsOptions
): object {
  const visit = ({
    left,
    right,
    map,
    depth
  }: ResetNonOverlappingPathsOptions & {
    depth: number;
  }): {[path: string]: object | string} => {
    let paths: {[path: string]: object | string} = {};
    let hasKeys = false;
    for (const relation of map) {
      const leftMatch = left.filter(segments => segments[depth] == relation.path);
      const rightMatch = right.filter(segments => segments[depth] == relation.path);

      if (!leftMatch.length && rightMatch.length) {
        hasKeys = true;

        const path = rightMatch[0].slice(0, depth + 1).join(".");

        if (relation.type == "onetoone") {
          paths[path] = `$${path}._id`;
        } else {
          paths[path] = {
            $map: {
              input: `$${path}`,
              as: "doc",
              in: `$$doc._id`
            }
          };
        }
      } else if (relation.children) {
        const subPaths = visit({
          left: leftMatch,
          right: rightMatch,
          depth: depth + 1,
          map: relation.children
        });
        if (subPaths) {
          hasKeys = true;
          paths = {...paths, ...subPaths};
        }
      }
    }

    return hasKeys ? paths : undefined;
  };

  const expressions = visit({left: options.left, right: options.right, map: options.map, depth: 0});
  return expressions ? {$set: expressions} : undefined;
}

export function compareAndUpdateRelations(relationMap: RelationMap[], usedRelations: string[]) {
  const updatedRelationMap: RelationMap[] = [];

  for (const map of relationMap) {
    if (!usedRelations.includes(map.path)) {
      const paths = createRelationPaths(deepCopy(map));
      usedRelations.push(...paths);
      updatedRelationMap.push(map);
      continue;
    }

    if (map.children && map.children.length) {
      for (const child of map.children) {
        child.path = map.path + "." + child.path;
      }
      const updatedChilds = compareAndUpdateRelations(map.children, usedRelations);
      updatedRelationMap.push(...updatedChilds);
    }
  }
  return updatedRelationMap;
}

function createRelationPaths(relationMap: RelationMap): string[] {
  const paths = [];
  paths.push(relationMap.path);

  if (relationMap.children && relationMap.children.length) {
    for (const childMap of relationMap.children) {
      childMap.path = relationMap.path + "." + childMap.path;
      const path = createRelationPaths(childMap);
      paths.push(...path);
    }
  }

  return paths;
}

function assertRelationType(type: RelationType) {
  if (type != RelationType.One && type != RelationType.Many) {
    throw new Error(`unknown relation type ${type}`);
  }
}

export function getUpdateParams(
  target: string,
  type: RelationType,
  documentId: string
): {filter: object; update: object} {
  assertRelationType(type);

  if (type == RelationType.One) {
    return {filter: {[target]: documentId}, update: {$unset: {[target]: ""}}};
  } else if (type == RelationType.Many) {
    return {
      filter: {[target]: {$in: [documentId]}},
      update: {$pull: {[target]: documentId}}
    };
  }
}

export function isObject(schema: any) {
  return schema.type == "object";
}

export function isRelation(schema: any) {
  return schema.type == "relation";
}

export function isDesiredRelation(schema: any, bucketId: string) {
  return isRelation(schema) && schema.bucketId == bucketId;
}

export function isArray(schema: any) {
  return schema.type == "array";
}

export function hasRelationChanges(previousSchema: any, currentSchema: any) {
  if (isRelation(previousSchema) && isRelation(currentSchema)) {
    return (
      previousSchema.relationType != currentSchema.relationType ||
      previousSchema.bucketId != currentSchema.bucketId
    );
  }

  return false;
}

export function buildRelationAggregation(
  property: string,
  bucketId: string,
  type: RelationType,
  locale: Locale,
  additionalPipeline?: object[]
): object[] {
  assertRelationType(type);
  const pipeline = [];

  let _let;

  if (type == RelationType.One) {
    _let = {
      documentId: {
        $toObjectId: `$${property}`
      }
    };
    pipeline.push({$match: {$expr: {$eq: ["$_id", "$$documentId"]}}});
  } else if (type == RelationType.Many) {
    _let = {
      documentIds: {
        $ifNull: [
          {
            $map: {
              input: `$${property}`,
              in: {$toObjectId: "$$this"}
            }
          },
          []
        ]
      }
    };
    pipeline.push({$match: {$expr: {$in: ["$_id", "$$documentIds"]}}});
  }

  if (additionalPipeline) {
    pipeline.push(...additionalPipeline);
  }

  if (locale) {
    pipeline.push({$replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)});
  }

  pipeline.push({$set: {_id: {$toString: "$_id"}}});

  const lookup = {
    $lookup: {
      from: getBucketDataCollection(bucketId),
      as: property,
      let: _let,
      pipeline
    }
  };

  return type == RelationType.One
    ? [lookup, {$unwind: {path: `$${property}`, preserveNullAndEmptyArrays: true}}]
    : [lookup];
}

export async function clearRelations(
  bucketService: BucketService,
  bucketId: ObjectId,
  documentId: ObjectId
) {
  let buckets = await bucketService.find({_id: {$ne: bucketId}});
  if (buckets.length < 1) {
    return;
  }

  for (const bucket of buckets) {
    let targets = findRelations(bucket.properties, bucketId.toHexString(), "", new Map());
    if (targets.size < 1) {
      continue;
    }

    for (const [target, type] of targets.entries()) {
      const updateParams = getUpdateParams(target, type, documentId.toHexString());
      await bucketService
        .collection(`bucket_${bucket._id.toHexString()}`)
        .updateMany(updateParams.filter, updateParams.update);
    }
  }
}
