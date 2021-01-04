import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {NUMBER, DEFAULT, JSONP} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {createPolicyActivity} from "./activity.resource";
import {Policy} from "./interface";
import {PolicyService} from "./policy.service";

@Controller("passport/policy")
export class PolicyController {
  constructor(private policy: PolicyService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:index"))
  find(
    @Query("filter", DEFAULT({}), JSONP) filter: object,
    @ResourceFilter() resourceFilter?: object,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number
  ) {
    return this.policy.find(filter, limit, skip);
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.policy.findOne(id);
  }

  @UseInterceptors(activity(createPolicyActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:create"))
  insertOne(@Body(Schema.validate("http://spica.internal/passport/policy")) body: Policy) {
    return this.policy.insertOne(body);
  }

  @UseInterceptors(activity(createPolicyActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:update"))
  replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy")) body: Policy
  ) {
    return this.policy.replaceOne({_id: id}, body);
  }

  @UseInterceptors(activity(createPolicyActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.policy.deleteOne(id);
  }
}
