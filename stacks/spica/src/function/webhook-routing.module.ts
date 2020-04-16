import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {IdentityGuard, PolicyGuard} from "../passport";
import {WebhookAddComponent} from "./pages/webhook-add/webhook-add.component";
import {WebhookIndexComponent} from "./pages/webhook-index/webhook-index.component";
import {WebhookLogViewComponent} from "./pages/webhook-log-view/webhook-log-view.component";

const routes: Routes = [
  {
    canActivate: [IdentityGuard, PolicyGuard],
    path: "webhook/logs",
    data: {service: "webhook"},
    children: [{path: "", component: WebhookLogViewComponent}]
  },
  {
    canActivate: [IdentityGuard, PolicyGuard],
    path: "webhook",
    data: {service: "webhook"},
    children: [
      {path: "", component: WebhookIndexComponent, data: {action: "index"}},
      {path: "add", component: WebhookAddComponent, data: {action: "create"}},
      {path: ":id", component: WebhookAddComponent, data: {action: "show"}}
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class WebhookRoutingModule {}
