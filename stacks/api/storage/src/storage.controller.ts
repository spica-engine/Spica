import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpException,
  Patch
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {BOOLEAN, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import * as etag from "etag";
import {createStorageActivity} from "./activity.resource";
import {
  addContentSize,
  BsonBodyParser,
  isBsonBody,
  isBufferCheck,
  isJsonBody,
  isMultipartFormDataArray,
  isMultipartFormDataBody,
  JsonBodyParser,
  MixedBody,
  MultipartFormDataParser,
  multipartToStorageObject,
  StorageObject
} from "./body";
import {StorageService} from "./storage.service";
import * as fs from "fs";

/**
 * @name storage
 */
@Controller("storage")
export class StorageController {
  constructor(private storage: StorageService) {}

  /**
   * @param limit The maximum amount documents that can be present in the response.
   * @param skip The amount of documents to skip.
   * @param sort A JSON string to sort the documents by its properties.
   * Example: Descending `{"content.size": -1}` OR Ascending `{"content.size": 1}`
   */
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("storage:index"))
  async find(
    @ResourceFilter() resourceFilter: object,
    @Query("filter", JSONP) filter?: object,
    @Query("paginate", BOOLEAN) paginate?: boolean,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: object
  ) {
    return this.storage.getAll(resourceFilter, filter, paginate, limit, skip, sort);
  }

  /**
   * Returns content of the object along with http caching headers.
   * When `if-none-match` header is present and matches the objects checksum, it will end the response with status code 304
   * for futher information check: https://en.wikipedia.org/wiki/HTTP_ETag
   * @param id Identifier of the object
   * @param ifNoneMatch When present and matches objects checksum, status code will be 304.
   */
  @Get(":id/view")
  async view(
    @Res() res,
    @Param("id", OBJECT_ID) id: ObjectId,
    @Headers("if-none-match") ifNoneMatch?: string
  ) {
    const object = await this.storage.get(id);
    if (!object) {
      throw new NotFoundException("Could not find the object.");
    }
    const eTag = etag(object.content.data);
    if (eTag === ifNoneMatch) {
      return res.status(HttpStatus.NOT_MODIFIED).end();
    }
    res.header("Content-type", object.content.type);
    res.header("ETag", eTag);
    res.header("Cache-control", "public, max-age=3600, must-revalidate");
    res.end(object.content.data);
  }

  /**
   * Returns metadata of the object size, content-type and url.
   * @param id Identifier of the object
   */
  @Get(":id")
  async findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const object = await this.storage.get(id);

    if (!object) {
      throw new NotFoundException("Could not find the object.");
    }

    object.url = await this.storage.getUrl(id.toHexString());

    delete object.content.data;
    return object;
  }

  @UseInterceptors(activity(createStorageActivity))
  @Patch(":id")
  @UseGuards(AuthGuard(), ActionGuard("storage:update", "storage/:id"))
  async patch(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(
      Schema.validate({
        type: "object",
        properties: {
          name: {
            type: ["string", "null"]
          }
        },
        additionalProperties: false
      })
    )
    {name}
  ) {
    const object = await this.storage.updateMeta(id, name);
    object.url = await this.storage.getUrl(id.toHexString());
    return object;
  }

  /**
   * Updates the object and content of the object.
   * @param id Identifier of the object
   * @body ```json
   * {
   *    "name": "updated name.txt",
   *    "content": {
   *      "type": "text/plain",
   *      "data": "Y29udGVudCBmcm9tIHN0b3JhZ2U="
   *    }
   * }
   * ```
   */
  @UseInterceptors(
    MultipartFormDataParser({isArray: false}),
    BsonBodyParser(),
    JsonBodyParser(),
    activity(createStorageActivity)
  )
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("storage:update"))
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/storage/body/single"))
    body
  ) {
    let object;

    if (isMultipartFormDataBody(body)) {
      object = multipartToStorageObject(body);
    } else {
      isBufferCheck(body);
      object = body;
      object = addContentSize(object)
    }

    object._id = id;

    object = await this.storage.update(id, object).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
    object.url = await this.storage.getUrl(id.toHexString());
    return object;
  }

  /**
   * Adds one or more object into the storage.
   * @accepts application/json
   * @body ```json
   *  [
   *     {
   *       "name": "file.txt",
   *       "content": {
   *         "type": "text/plain",
   *         "data": "Y29udGVudCBmcm9tIHN0b3JhZ2U="
   *       }
   *     }
   *   ]
   * ```
   */
  @UseInterceptors(
    MultipartFormDataParser({isArray: true}),
    BsonBodyParser(),
    JsonBodyParser(),
    activity(createStorageActivity)
  )
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("storage:create"))
  async insertMany(@Body(Schema.validate("http://spica.internal/storage/body")) body: MixedBody) {
    let objects = new Array<StorageObject<fs.ReadStream | Buffer>>();

    // instead of this if else checks, we can use content-type header of request.
    if (isMultipartFormDataArray(body)) {
      objects = body.map(object => multipartToStorageObject(object));
    } else if (isBsonBody(body)) {
      body.content.forEach(object => isBufferCheck(object));
      objects = body.content.map(object => addContentSize(object));
    } else if (isJsonBody(body)) {
      objects = body.map(object => addContentSize(object));
    } else {
      throw new BadRequestException("Unknown content-type");
    }

    objects = await this.storage.insert(objects).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });

    for (const object of objects) {
      object.url = await this.storage.getUrl(object._id.toString());
    }
    return objects;
  }

  /**
   * Removes the object from the storage along with its metadata
   * @param id Identifier of the object
   */
  @UseInterceptors(activity(createStorageActivity))
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("storage:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.storage.delete(id);
  }
}
