import {animate, style, transition, trigger} from "@angular/animations";
import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable, of, merge, throwError, BehaviorSubject, Subject} from "rxjs";
import {
  delay,
  flatMap,
  map,
  share,
  tap,
  ignoreElements,
  endWith,
  catchError,
  switchMap,
  switchMapTo
} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketRow} from "../../interfaces/bucket-entry";
import {BucketHistory} from "../../interfaces/bucket-history";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketHistoryService} from "../../services/bucket-history.service";
import {BucketService} from "../../services/bucket.service";
import {SavingState} from "@spica-client/material";

@Component({
  selector: "bucket-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"],
  animations: [
    trigger("smooth", [
      transition(":enter", [style({opacity: 0}), animate("0.3s ease-out", style({opacity: 1}))]),
      transition(":leave", [style({opacity: 1}), animate("0.3s ease-in", style({opacity: 0}))])
    ])
  ]
})
export class AddComponent implements OnInit {
  bucketId: string;
  data: BucketRow = {};
  now: BucketRow;
  minScheduleDate: Date = new Date();
  bucket$: Observable<Bucket>;
  histories$: Observable<Array<BucketHistory>>;

  $save: Observable<SavingState>;

  private refreshHistory = new BehaviorSubject(undefined);

  savingBucketState: Boolean = false;

  readonly layouts = ["left", "right", "bottom"];

  readonly isHandset$: Observable<boolean>;

  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private bhs: BucketHistoryService,
    private router: Router,
    private route: ActivatedRoute,
    breakpointObserver: BreakpointObserver
  ) {
    this.isHandset$ = breakpointObserver
      .observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall])
      .pipe(map(r => r.matches));
  }

  ngOnInit(): void {
    this.bucket$ = this.route.params.pipe(
      tap(params => {
        this.$save = of(SavingState.Pristine);
        this.bucketId = params.id;
      }),
      flatMap(params => {
        if (params.rid) {
          return this.bds.findOne(params.id, params.rid, true).pipe(
            tap(data => {
              this.data = data;
            }),
            flatMap(() => this.bs.getBucket(params.id))
          );
        }
        return this.bs.getBucket(params.id);
      }),
      map(schema => {
        if (schema.history && this.data._id) {
          this.histories$ = this.refreshHistory.pipe(
            switchMapTo(
              this.bhs.historyList(this.bucketId, this.data._id).pipe(
                catchError(err => {
                  if (err.status == 404) {
                    this.histories$ = undefined;
                    return of(undefined);
                  } else {
                    return throwError(err);
                  }
                })
              )
            )
          );
        }
        this.data._schedule = this.data._schedule && new Date(this.data._schedule);
        // What we do here is simply coercing the translated data
        Object.keys(schema.properties).forEach(key => {
          const property = schema.properties[key];
          if (property.options && property.options.translate) {
            this.data[key] = this.data[key] || {};
          }
        });
        schema["positioned"] = Object.entries(schema.properties).reduce(
          (accumulator, [key, value]) => {
            if (accumulator[value.options.position]) {
              accumulator[value.options.position].push({key, value});
            }
            return accumulator;
          },
          {left: [], right: [], bottom: []}
        );
        return schema;
      }),
      delay(1),
      share()
    );
  }

  async revert(historyId: string) {
    if (!this.now) {
      this.now = this.data;
    }
    this.data = await this.bhs.revertTo(this.bucketId, this.data._id, historyId).toPromise();
  }

  schedule() {
    this.data._schedule = new Date();
  }

  cancelSchedule() {
    this.data._schedule = undefined;
  }

  saveBucketRow() {
    if (!(this.data._schedule instanceof Date)) {
      delete this.data._schedule;
    }

    const isInsert = !this.data._id;

    const save = isInsert
      ? this.bds.insertOne(this.bucketId, this.data)
      : this.bds.replaceOne(this.bucketId, this.data);

    this.$save = merge(
      of(SavingState.Saving),
      save.pipe(
        tap(bucketDocument => {
          this.refreshHistory.next(undefined);
          if (isInsert) return this.router.navigate([`bucket/${this.bucketId}`]);
        }),
        ignoreElements(),
        endWith(SavingState.Saved),
        catchError(() => of(SavingState.Failed))
      )
    );
  }
}
