import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
  UseInterceptors,
  Optional,
  Inject
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {AuthGuard, ActionGuard} from "@spica-server/passport";
import {
  Preference,
  PreferenceService,
  PREFERENCE_CHANGE_FINALIZER,
  LanguageChangeUpdater
} from "../services";
import {createPreferenceActivity} from "./activity.resource";

@Controller("preference")
export class PreferenceController {
  constructor(
    private preference: PreferenceService,
    @Optional()
    @Inject(PREFERENCE_CHANGE_FINALIZER)
    private updaterFactory: LanguageChangeUpdater
  ) {}

  @Get(":scope")
  @UseGuards(AuthGuard(), ActionGuard("preference:show"))
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @UseInterceptors(activity(createPreferenceActivity))
  @Put(":scope")
  @UseGuards(AuthGuard(), ActionGuard("preference:update"))
  async replaceOne(@Param("scope") scope: string, @Body() preference: Preference) {
    if (scope == "bucket" && this.updaterFactory) {
      let previousPrefs = await this.preference.get("bucket");
      await this.updaterFactory(previousPrefs, preference);
    }
    delete preference._id;
    preference.scope = scope;
    return this.preference.replaceOne({scope}, preference, {upsert: true, returnOriginal: false});
  }
}
