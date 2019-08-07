import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {DocListComponent} from "./pages/doc-list/doc-list.component";
import {DocComponent} from "./pages/doc/doc.component";
import {DocsLayoutComponent} from "./pages/docs-layout/docs-layout.component";
import {DocsComponent} from "./pages/docs/docs.component";
import {HomeComponent} from "./pages/home/home.component";
import {FeaturesComponent} from "./pages/features/features.component";

const routes: Routes = [
  {
    path: "",
    component: HomeComponent
  },
  {
    path: "docs",
    component: DocsLayoutComponent,
    children: [
      {
        path: "",
        component: DocsComponent
      },
      {
        path: "api/:apiName",
        component: DocListComponent
      },
      {
        path: "api/:apiName/:docName",
        component: DocComponent
      },
      {
        path: ":contentName/:docName",
        component: DocComponent
      },
      {
        path: ":contentName",
        component: DocComponent
      }
    ]
  },
  {
    path: "features",
    component: FeaturesComponent
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {anchorScrolling: "enabled", scrollPositionRestoration: "enabled"})
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
