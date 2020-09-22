import {Body, Controller, Get, Param, Put, UseGuards, UseInterceptors} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {AuthGuard, ActionGuard} from "@spica-server/passport";
import {Preference, PreferenceService} from "../services";
import {createPreferenceActivity} from "./activity.resource";

@Controller("preference")
export class PreferenceController {
  constructor(private preference: PreferenceService) {}

  @Get(":scope")
  @UseGuards(AuthGuard(), ActionGuard("preference:show"))
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @UseInterceptors(activity(createPreferenceActivity))
  @Put(":scope")
  @UseGuards(AuthGuard(), ActionGuard("preference:update"))
  replaceOne(@Param("scope") scope: string, @Body() preference: Preference) {
    delete preference._id;
    preference.scope = scope;
    return this.preference.replaceOne({scope}, preference, {upsert: true, returnOriginal: false});
  }
}
