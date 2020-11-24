import {ScrollingModule} from "@angular/cdk/scrolling";
import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatOptionModule} from "@angular/material/core";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {ActivityRoutingModule} from "@spica-client/activity/activity-routing.module";
import {IndexComponent} from "@spica-client/activity/pages/index/index.component";
import {CommonModule as SpicaCommon} from "@spica-client/common";
import {PassportModule} from "@spica-client/passport";
import {ActivityService} from "./services/activity.service";

@NgModule({
  declarations: [IndexComponent],
  imports: [
    CommonModule,
    ActivityRoutingModule,
    PassportModule.forChild(),
    MatIconModule,
    MatToolbarModule,
    MatCardModule,
    MatTableModule,
    MatOptionModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    FormsModule,
    MatButtonModule,
    ScrollingModule,
    MatListModule,
    MatProgressSpinnerModule,
    SpicaCommon,
    MatTooltipModule
  ],
  providers: [ActivityService]
})
export class ActivityModule {}
