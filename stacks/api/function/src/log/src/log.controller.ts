import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import {ARRAY, DATE, DEFAULT, NUMBER} from "@spica-server/core";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import {LogService} from "./log.service";

@Controller("function-logs")
export class LogController {
  constructor(private logService: LogService) {}

  @Get()
  @UseGuards(AuthGuard())
  logs(
    @Query("limit", NUMBER) limit: number,
    @Query("skip", NUMBER) skip: number,
    @Query("begin", DEFAULT(() => new Date().setUTCHours(0, 0, 0, 0)), DATE) begin: Date,
    @Query("end", DEFAULT(() => new Date().setUTCHours(23, 59, 59, 999)), DATE) end: Date,
    @Query("functions", ARRAY(String)) functions: string[],
    @Query("channel") channel: string
  ) {
    const match: any = {
      _id: {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      }
    };

    if (channel) {
      match.channel = channel;
    }

    if (functions && functions.length) {
      match.function = {
        $in: functions
      };
    }

    const pipeline: any[] = [
      {
        $match: match
      },
      {$sort: {_id: -1}},
      {
        $lookup: {
          from: "function",
          let: {fn: {$toObjectId: "$function"}},
          pipeline: [{$match: {$expr: {$eq: ["$_id", "$$fn"]}}}],
          as: "fn"
        }
      },
      {$unwind: "$fn"},
      {$set: {function: "$fn.name"}},
      {$unset: ["fn"]}
    ];

    if (skip > 0) {
      pipeline.push({$skip: skip});
    }

    if (limit > 0) {
      pipeline.push({$limit: limit});
    }

    return this.logService.aggregate(pipeline).toArray();
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  clearLogs(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.logService.deleteMany({
      function: id.toHexString()
    });
  }
}
