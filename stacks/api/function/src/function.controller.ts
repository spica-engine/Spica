import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {ARRAY, BOOLEAN, DEFAULT} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {Scheduler} from "@spica-server/function/scheduler";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import * as os from "os";
import {from, of, OperatorFunction} from "rxjs";
import {catchError, finalize, last, map, take, tap} from "rxjs/operators";
import {createFunctionActivity} from "./activity.resource";
import {FunctionEngine} from "./engine";
import {FunctionService} from "./function.service";
import {Function, Trigger} from "./interface";
import {FUNCTION_OPTIONS, Options} from "./options";
import {generate} from "./schema/enqueuer.resolver";

/**
 * @name Function
 * @description These APIs are responsible for all function operations.
 */
@Controller("function")
export class FunctionController {
  constructor(
    private fs: FunctionService,
    private engine: FunctionEngine,
    private scheduler: Scheduler,
    @Inject(FUNCTION_OPTIONS) private options: Options
  ) {}

  /**
   * @description Returns all available enqueuers, runtimes, and the timeout information.
   * @param id Identifier of the function
   */
  @Get("information")
  @UseGuards(AuthGuard())
  async information() {
    const enqueuers = [];

    for (const enqueuer of this.scheduler.enqueuers) {
      enqueuers.push({
        description: enqueuer.description,
        options: await from(this.engine.getSchema(enqueuer.description.name))
          .pipe(take(1))
          .toPromise()
      });
    }

    const runtimes = [];
    for (const [_, runtime] of this.scheduler.runtimes) {
      runtimes.push(runtime.description);
    }

    return {enqueuers, runtimes, timeout: this.options.timeout};
  }

  /**
   * @description Returns all available function objects.
   * @param id Identifier of the function
   */
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("function:index"))
  index() {
    return this.fs.find();
  }

  /**
   * @description Returns the function object
   * @param id Identifier of the function
   */
  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.fs.findOne({_id: id});
  }

  /**
   * @description Removes the function object along with its index and dependencies.
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOneAndDelete({_id: id}, {});
    if (!fn) {
      throw new NotFoundException("Couldn't find the function.");
    }
    await this.engine.deleteFunction(fn);
  }

  private async hasDuplicatedBucketHandlers(fn: Function): Promise<boolean> {
    const functions = (await this.fs.find({_id: {$ne: fn._id}})).concat(fn);
    const triggers = functions.reduce((acc, fn) => {
      for (const handler in fn.triggers) {
        if (fn.triggers.hasOwnProperty(handler)) {
          const trigger = fn.triggers[handler];
          acc.push(trigger);
        }
      }
      return acc;
    }, new Array<Trigger>());

    return triggers
      .filter(trigger => trigger.type == "bucket")
      .some((trigger, index, triggers) => {
        const foundIndex = triggers.findIndex(
          t =>
            t.options["bucket"] == trigger.options["bucket"] &&
            t.options["type"] == trigger.options["type"]
        );
        return foundIndex != index;
      });
  }

  /**
   * @description Replaces a function object and returns the latest committed version of function object.<br>
   * Keep in mind that `language` is immutable and ignored silently if present
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("function:update"))
  async replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate(generate)) fn: Function
  ) {
    fn._id = id;
    const hasDuplicatedHandlers = await this.hasDuplicatedBucketHandlers(fn);
    if (hasDuplicatedHandlers) {
      throw new BadRequestException(
        "Multiple handlers on same bucket and event type are not supported."
      );
    }
    delete fn._id;
    // Language is immutable
    delete fn.language;
    return this.fs.findOneAndUpdate({_id: id}, {$set: fn}, {returnOriginal: false});
  }

  /**
   * @description Adds the function object present in the body and returns the inserted function object.
   * @param id Identifier of the function
   */
  @UseInterceptors(activity(createFunctionActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("function:create"))
  async insertOne(@Body(Schema.validate(generate)) fn: Function) {
    const hasDuplicatedHandlers = await this.hasDuplicatedBucketHandlers(fn);
    if (hasDuplicatedHandlers) {
      throw new BadRequestException(
        "Multiple handlers on same bucket and event type are not supported."
      );
    }
    fn = await this.fs.insertOne(fn);
    await this.engine.createFunction(fn);
    return fn;
  }

  /**
   * @description Replaces index(code) of the function with the index in the body. <br>
   * Also, it compiles the index to make it ready for execution.
   * @param id Identifier of the function
   */
  @Post(":id/index")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  async updateIndex(@Param("id", OBJECT_ID) id: ObjectId, @Body("index") index: string) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Cannot find function.");
    }
    await this.engine.update(fn, index);
    return this.engine
      .compile(fn)
      .catch(diagnostics => Promise.reject(new HttpException(diagnostics, 422)));
  }

  /**
   * @description Returns index(code) of the function
   * @param id Identifier of the function
   */
  @Get(":id/index")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  async showIndex(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Can not find function.");
    }
    const index = await this.engine.read(fn);
    return {index};
  }

  /**
   * @description Returns of dependencies of the function with their versions.
   * @param id Identifier of the function
   */
  @Get(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:show", "function/:id"))
  async getDependencies(@Param("id", OBJECT_ID) id: ObjectId) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }
    return this.engine.getPackages(fn);
  }

  /**
   * @description Adds one or more dependency to the function
   * @param progress When true, installation progress is reported.
   * @param id Identifier of the function
   */
  @Post(":id/dependencies")
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  @Header("X-Content-Type-Options", "nosniff")
  async addDependency(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body("name", DEFAULT([]), ARRAY(String)) name: string[],
    @Res() res,
    @Query("progress", BOOLEAN) progress?: boolean
  ) {
    if (!name) {
      throw new BadRequestException("Dependency name is required.");
    }
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }

    let operators: OperatorFunction<unknown, unknown>[] = [
      catchError(err => {
        res.status(400).send({message: err.toString()});
        return err;
      })
    ];

    if (progress) {
      operators = [];
      operators.push(
        map(progress => {
          return {
            progress,
            state: "installing"
          };
        }),
        catchError(error =>
          of({
            state: "failed",
            message: error
          })
        ),
        tap(response => res.write(`${JSON.stringify(response)}${os.EOL}`))
      );
    }
    operators.push(last(), finalize(() => res.end()));

    return (this.engine.addPackage(fn, name) as any).pipe(...operators);
  }

  /**
   * @description Removes a dependency from the function
   * @param id Identifier of the function
   * @param name Name of the dependency to remove
   */
  @Delete(":id/dependencies/:name(*)")
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDependency(@Param("id", OBJECT_ID) id: ObjectId, @Param("name") name: string) {
    const fn = await this.fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }
    return this.engine.removePackage(fn, name).catch(error => {
      throw new BadRequestException(error.message);
    });
  }
}
