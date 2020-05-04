import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import {Activity, ActivityService} from "@spica-server/activity/services";
import {DATE, JSONP, NUMBER, DEFAULT, ARRAY} from "@spica-server/core";
import {DatabaseService, FilterQuery, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";

@Controller("activity")
export class ActivityController {
  constructor(private activityService: ActivityService, private database: DatabaseService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("activity:index"))
  find(
    @Query("identifier") identifier,
    @Query("action", DEFAULT([]), ARRAY(Number)) action: number[],
    @Query("resource", DEFAULT([]), ARRAY(String)) resource: string[],
    @Query("begin", DATE) begin: Date,
    @Query("end", DATE) end: Date,
    @Query("skip", NUMBER) skip: number,
    @Query("limit", NUMBER) limit: number
  ): Promise<Activity[]> {
    let aggregation: object[] = [
      {
        $lookup: {
          from: "identity",
          localField: "identifier",
          foreignField: "_id",
          as: "identifier"
        }
      },
      {$unwind: "$identifier"},
      {
        $set: {
          identifier: "$identifier.identifier"
        }
      },
      {
        $addFields: {
          date: {$toDate: "$_id"}
        }
      }
    ];

    let filter: FilterQuery<Activity> = {};

    if (identifier) filter.identifier = identifier;

    if (!isNaN(begin.getTime()) && !isNaN(end.getTime())) {
      filter._id = {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      };
    }

    if (action.length > 0) {
      filter["$or"] = action.map(act => {
        return {action: act};
      });
      // if (Array.isArray(action) && action.length > 0) {
      //   filter["$or"] = action.map(val => {
      //     return {action: Number(val)};
      //   });
      // } else if (!Array.isArray(action)) {
      //   filter["$or"] = [{action: Number(action)}];
      // }
    }

    if (resource.length > 0) {
      //
    }

    if (filter) aggregation.push({$match: filter});

    if (skip) aggregation.push({$skip: skip});

    if (limit) aggregation.push({$limit: limit});

    return this.activityService.aggregate(aggregation).toArray();
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("activity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.activityService.deleteOne({_id: id});
  }

  @Delete()
  @UseGuards(AuthGuard(), ActionGuard("activity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMany(@Body() ids: ObjectId[]) {
    return this.activityService.deleteMany({_id: {$in: ids.map(id => new ObjectId(id))}});
  }
}
