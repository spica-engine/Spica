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
import {ARRAY, DATE, DEFAULT} from "@spica-server/core";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import {LogService} from "./log.service";

@Controller("function")
export class LogController {
  constructor(private logService: LogService) {}

  @Get("logs")
  @UseGuards(AuthGuard())
  logs(
    @Query("begin", DEFAULT(new Date().setUTCHours(0, 0, 0, 0)), DATE) begin: Date,
    @Query("end", DEFAULT(new Date().setUTCHours(23, 59, 59, 999)), DATE) end: Date,
    @Query("functions", ARRAY(String)) functions: string[]
  ) {
    return this.logService
      .aggregate([
        {
          $match: {
            function: {
              $in: functions
            },
            _id: {
              $gte: ObjectId.createFromTime(begin.getTime() / 1000),
              $lt: ObjectId.createFromTime(end.getTime() / 1000)
            }
          }
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
        {$set: {created_at: {$toDate: "$_id"}, function: "$fn.name"}},
        {$unset: ["fn"]}
      ])
      .toArray();
  }

  @Delete(":id/logs")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  clearLogs(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.logService.deleteMany({
      function: id.toHexString()
    });
  }
}
