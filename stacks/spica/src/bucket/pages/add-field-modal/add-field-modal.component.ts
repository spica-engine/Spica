import {Component, Inject, OnInit} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {BucketService} from "@spica-client/bucket/services/bucket.service";
import {InputPlacerWithMetaPlacer} from "@spica-client/common";
import {InputResolver} from "@spica-client/common/input/input.resolver";
import {PredefinedDefault} from "@spica-client/passport/interfaces/predefined-default";
import {map} from "rxjs/internal/operators/map";
import {take} from "rxjs/operators";

@Component({
  selector: "app-add-field-modal",
  templateUrl: "./add-field-modal.component.html",
  styleUrls: ["./add-field-modal.component.scss"]
})
export class AddFieldModalComponent implements OnInit {
  step = 0;
  field: string;
  parentSchema: any;
  propertyKey: string = "";
  propertyKv: any;

  translatableTypes = ["string", "textarea", "array", "object", "richtext", "storage"];
  basicPropertyTypes = ["string", "textarea", "boolean", "number"];
  visibleTypes = [
    "string",
    "textarea",
    "boolean",
    "number",
    "relation",
    "date",
    "color",
    "storage"
  ];
  immutableProperties: Array<string> = [];
  predefinedDefaults: {[key: string]: PredefinedDefault[]};

  systemFields: InputPlacerWithMetaPlacer[] = [];
  fieldConfig: InputPlacerWithMetaPlacer;
  constructor(
    private _inputResolver: InputResolver,
    private bs: BucketService,
    public dialogRef: MatDialogRef<AddFieldModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data
  ) {}

  ngOnInit(): void {
    this.bs
      .getPredefinedDefaults()
      .pipe(
        map(predefs => {
          this.predefinedDefaults = predefs.reduce((accumulator, item) => {
            accumulator[item.type] = accumulator[item.type] || [];
            accumulator[item.type].push(item);
            return accumulator;
          }, {});
        }),
        take(1)
      )
      .subscribe();
    this._inputResolver.entries().map(e => this.systemFields.push(this._inputResolver.resolve(e)));
    this.parentSchema = this.data.parentSchema;
    this.immutableProperties = Object.keys(this.parentSchema.properties);
    if (this.data.propertyKey) {
      this.step = 1;
      this.propertyKey = this.data.propertyKey;
      this.propertyKv = this.parentSchema.properties[this.propertyKey];
      this.field = this.propertyKv.type;
      this.fieldConfig = this.systemFields.filter(systemField => systemField.type == this.field)[0];
    }
  }

  chooseFieldType(field) {
    this.field = field;
    this.step = 1;
  }

  addProperty(name: string, description: string = null) {
    if (!description) description = `Description of the ${name} input`;
    this.propertyKey = name.toLowerCase();
    if (name && !this.parentSchema.properties[this.propertyKey]) {
      this.propertyKv = this.parentSchema.properties[this.propertyKey] = {
        type: this.field,
        title: this.propertyKey,
        description: description,
        options: {
          position: "bottom"
        }
      };
      this.fieldConfig = this.systemFields.filter(systemField => systemField.type == this.field)[0];
    }
  }

  save() {
    this.dialogRef.close();
  }

  toggleRequired(key: string, required: boolean) {
    this.parentSchema.required = this.parentSchema.required || [];
    required
      ? this.parentSchema.required.push(key)
      : this.parentSchema.required.splice(this.parentSchema.required.indexOf(key), 1);
  }
}
