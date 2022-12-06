import {Component, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Asset, InstallationPreviewByModules, Resource} from "@spica-client/asset/interfaces";
import {AssetService} from "@spica-client/asset/services/asset.service";
import {merge, Observable, of} from "rxjs";
import {catchError, endWith, filter, ignoreElements, switchMap, tap} from "rxjs/operators";
import {ICONS, SavingState} from "@spica-client/material";
import {NestedTreeControl} from "@angular/cdk/tree";
import {MatTreeNestedDataSource} from "@angular/material/tree";
import {displayPreview, separatePreviewResourcesByModule} from "@spica-client/asset/helpers";

interface AssetNode {
  name: string;
  children?: AssetNode[];
}

@Component({
  selector: "app-edit",
  templateUrl: "./edit.component.html",
  styleUrls: ["./edit.component.scss"]
})
export class EditComponent {
  $save: Observable<SavingState>;

  preview: InstallationPreviewByModules = {};

  constructor(private route: ActivatedRoute, private assetService: AssetService) {
    this.route.params
      .pipe(
        tap(() => (this.$save = of(SavingState.Pristine))),
        switchMap(params => this.assetService.findById(params.id)),
        filter(asset => !!asset)
      )
      .subscribe(asset => {
        this.asset = asset;
        this.dataSource = this.categorizeResourcesByModule(asset.resources) as any;
      });
  }

  asset: Asset;

  treeControl = new NestedTreeControl<AssetNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<AssetNode>();

  icons: Array<string> = ICONS;
  readonly iconPageSize = 24;
  visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  save() {
    this.$save = merge(
      of(SavingState.Saving),
      this.assetService.install(this.asset._id, this.asset.configs, false).pipe(
        ignoreElements(),
        endWith(SavingState.Saved),
        catchError(() => of(SavingState.Failed))
      )
    );
  }

  setInstallationPreview() {
    this.assetService
      .install(this.asset._id, this.asset.configs, true)
      .toPromise()
      .then(r => (this.preview = separatePreviewResourcesByModule(r)));
  }

  show(resources: Resource[]) {
    displayPreview(resources);
  }

  // categorizeResourcesByModule(resources) {
  //   const categorizedResources = {};

  //   for (const resource of resources) {
  //     categorizedResources[resource.module] = categorizedResources[resource.module] || [];
  //     categorizedResources[resource.module].push(resource);
  //   }

  //   return categorizedResources;
  // }

  buildResourceName(resource) {
    return resource.contents.schema.title || resource.contents.schema.name || resource._id;
  }

  categorizeResourcesByModule(resources) {
    const categorizedResources: AssetNode[] = [];

    for (const resource of resources) {
      let indexOfCategory = categorizedResources.findIndex(c => c.name == resource.module);

      if (indexOfCategory == -1) {
        categorizedResources.push({name: resource.module, children: []});
        indexOfCategory = categorizedResources.length - 1;
      }

      categorizedResources[indexOfCategory].children.push({
        name: this.buildResourceName(resource),
        children: []
      });
    }

    console.log(categorizedResources);

    return categorizedResources;
  }

  hasChild = (_: number, node: AssetNode) => !!node.children && node.children.length > 0;
}
