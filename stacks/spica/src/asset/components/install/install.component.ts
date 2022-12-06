import {Component, Inject} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {
  Asset,
  InstallationPreview,
  InstallationPreviewByModules,
  Resource
} from "@spica-client/asset/interfaces";
import {displayPreview, separatePreviewResourcesByModule} from "@spica-client/asset/helpers";
import {AssetService} from "@spica-client/asset/services/asset.service";

@Component({
  selector: "asset-install-dialog",
  templateUrl: "./install.component.html",
  styleUrls: ["./install.component.scss"]
})
export class AssetInstallDialog {
  step = 0;

  installationPreview: InstallationPreviewByModules = {};

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private assetService: AssetService,
    public dialogRef: MatDialogRef<any>
  ) {}

  preview() {
    this.step = 1;
    return this.assetService
      .install(this.data.asset._id, this.data.asset.configs, true)
      .toPromise()
      .then(preview => (this.installationPreview = separatePreviewResourcesByModule(preview)));
  }

  configure() {
    this.step = 0;
    this.installationPreview = {};
  }

  install(asset: Asset) {
    return this.dialogRef.close(asset);
  }

  show(resources:Resource[]) {
    displayPreview(resources);
  }
}
