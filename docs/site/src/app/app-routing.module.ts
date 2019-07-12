import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {DocListComponent} from "./pages/doc-list/doc-list.component";
import {DocComponent} from "./pages/doc/doc.component";
import {DocsComponent} from "./pages/docs/docs.component";

const routes: Routes = [
  {
    path: "docs",
    component: DocsComponent
  },
  {
    path: "docs/api/:apiName",
    component: DocListComponent
  },
  {
    path: "docs/api/:apiName/:docName",
    component: DocComponent
  },
  {
    path: "docs/:contentName/:docName",
    component: DocComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {anchorScrolling: "enabled"})],
  exports: [RouterModule]
})
export class AppRoutingModule {}
