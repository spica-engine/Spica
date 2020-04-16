import {
  Component,
  forwardRef,
  HostListener,
  Inject,
  OnInit,
  ViewChild,
  EventEmitter
} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatPaginator} from "@angular/material/paginator";
import {INPUT_SCHEMA} from "@spica-client/common";
import {merge, Observable, of} from "rxjs";
import {map, switchMap, tap, take} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketData, BucketRow} from "../../interfaces/bucket-entry";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {RelationSchema} from "../relation";
import {MatMenu} from "@angular/material";

@Component({
  selector: "bucket-relation",
  templateUrl: "./relation.component.html",
  styleUrls: ["./relation.component.scss"],
  providers: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => RelationComponent)}
  ]
})
export class RelationComponent implements ControlValueAccessor, OnInit {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild("filterMenu", {static: true}) filterMenu: MatMenu;

  value: string;

  onTouchedFn: Function = () => {};
  onChangeFn: Function = () => {};

  filter: {[key: string]: any} = {};
  bucket: Bucket;

  refresh = new EventEmitter();

  $row: Observable<BucketRow>;
  $meta: Observable<Bucket>;
  $data: Observable<BucketData>;

  displayedProperties: Array<string> = [];

  constructor(
    @Inject(INPUT_SCHEMA) public schema: RelationSchema,
    private bds: BucketDataService,
    bs: BucketService
  ) {
    this.$meta = bs.getBucket(schema.bucketId).pipe(
      tap(bSchema => {
        if (bSchema) {
          this.displayedProperties = Object.entries(bSchema.properties)
            .filter(([, value]) => value.options.visible)
            .map(([key]) => key)
            .concat("actions");
        }
      })
    );
  }

  ngOnInit() {
    this.$meta.pipe(take(1)).subscribe(bucketSchema => (this.bucket = bucketSchema));

    this.$data = merge(this.paginator.page, of(null), this.refresh).pipe(
      switchMap(() =>
        this.bds.find(this.schema.bucketId, {
          filter: this.filter && Object.keys(this.filter).length > 0 && this.filter,
          limit: this.paginator.pageSize || 12,
          skip: this.paginator.pageSize * this.paginator.pageIndex
        })
      ),
      map(buckets => {
        this.paginator.length = 0;
        if (buckets.meta && buckets.meta.total) {
          this.paginator.length = buckets.meta.total;
        }
        return buckets.data;
      })
    );
  }

  _fetchRow(id: string): void {
    this.$row = this.bds.findOne(this.schema.bucketId, id, false);
  }

  _selectRow(row: BucketRow): void {
    this.value = row._id;
    this._fetchRow(this.value);
    if (this.onChangeFn) {
      this.onChangeFn(this.value);
    }
  }

  @HostListener("click")
  onTouched(): void {
    this.onTouchedFn();
  }

  writeValue(val: string): void {
    this.value = val;

    this._fetchRow(this.value);
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }

  closeMenu() {
    this.filterMenu.close.emit();
  }
}
