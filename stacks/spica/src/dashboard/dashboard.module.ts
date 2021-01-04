import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatSortModule} from "@angular/material/sort";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {BrowserModule} from "@angular/platform-browser";
import {StoreModule} from "@ngrx/store";
import {InputModule} from "@spica-client/common";
import {LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {ChartsModule} from "ng2-charts";
import {PassportService, PassportModule} from "../passport";
import {DashboardRoutingModule} from "./dashboard-routing.module";
import {DashboardViewComponent} from "./pages/dashboard-view/dashboard-view.component";
import {DashboardComponent} from "./pages/dashboard/dashboard.component";
import {DashboardInitializer} from "./services/dashboard.initializer";
import {DashboardService} from "./services/dashboard.service";
import * as fromDashboard from "./state/dashboard.reducer";
import {TutorialComponent} from "./pages/tutorial/tutorial.component";
import {MatStepperModule} from "@angular/material/stepper";
import {MatSelectModule} from "@angular/material/select";
import {MatTabsModule} from "@angular/material/tabs";
import {MatTableModule} from "@angular/material/table";
import {MatClipboardModule, MatAwareDialogModule} from "@spica-client/material";
import {AddComponent} from "./pages/add/add.component";
import {IndexComponent} from "./pages/index/index.component";
import {MatMenuModule} from "@angular/material/menu";
import {CommonModule as SpicaCommon} from "@spica-client/common";
import {DefaultComponent} from "./components/default/default.component";
import {TableComponent} from "./components/table/table.component";
import {OwlDateTimeModule, OwlNativeDateTimeModule} from "@danielmoncada/angular-datetime-picker";
import {WelcomeComponent} from "./pages/welcome/welcome.component";

@NgModule({
  imports: [
    SpicaCommon,
    CommonModule,
    MatCardModule,
    MatListModule,
    MatMenuModule,
    DashboardRoutingModule,
    MatToolbarModule,
    MatIconModule,
    ChartsModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    BrowserModule,
    MatButtonModule,
    MatTooltipModule,
    MatSortModule,
    StoreModule.forFeature("dashboard", fromDashboard.reducer),
    InputModule,
    FormsModule,
    MatStepperModule,
    MatSelectModule,
    MatTabsModule,
    MatTableModule,
    MatClipboardModule,
    OwlDateTimeModule,
    OwlNativeDateTimeModule,
    MatAwareDialogModule,
    PassportModule.forChild()
  ],
  declarations: [
    DashboardComponent,
    DashboardViewComponent,
    TutorialComponent,
    AddComponent,
    IndexComponent,
    DefaultComponent,
    TableComponent,
    WelcomeComponent
  ],
  providers: [
    DashboardService,
    {
      provide: DashboardInitializer,
      useClass: DashboardInitializer,
      deps: [DashboardService, RouteService, PassportService]
    },
    {
      provide: LAYOUT_INITIALIZER,
      useFactory: provideDashboardLoader,
      multi: true,
      deps: [DashboardInitializer]
    }
  ]
})
export class DashboardModule {}

export function provideDashboardLoader(l: DashboardInitializer) {
  return l.appInitializer.bind(l);
}
