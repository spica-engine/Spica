import {Component, OnInit} from "@angular/core";
import {Activity, ActivityFilter} from "@spica-client/activity/interface";
import {ActivityService} from "@spica-client/activity/services/activity.service";
import {Observable, BehaviorSubject, Subscription, pipe} from "rxjs";
import {DataSource, CollectionViewer} from "@angular/cdk/collections";
import {tap, map, mergeMap} from "rxjs/operators";

@Component({
  selector: "activity-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent extends DataSource<Activity> implements OnInit {
  moduleGroups = [
    {
      name: "Bucket-Data",
      modules: []
    },
    {
      name: "Bucket",
      modules: ["Bucket", "Bucket-Settings"]
    },
    {
      name: "Passport",
      modules: ["Identity", "Identity-Settings", "Policy", "Apikey"]
    },
    {
      name: "Storage",
      modules: ["Storage"]
    },
    {
      name: "Function",
      modules: ["Function"]
    }
  ];

  actions = ["Insert", "Update", "Delete"];
  documentIds: [];

  isPending = false;

  private cachedActivities = new Array<Activity>();

  private subscription = new Subscription();

  private dataStream = new BehaviorSubject<(Activity | undefined)[]>(this.cachedActivities);

  private lastPage = 0;

  private pageIndex = 0;

  private defaultLimit = 20;

  connect(collectionViewer: CollectionViewer): Observable<(Activity | undefined)[]> {
    this.subscription.add(
      collectionViewer.viewChange.subscribe(range => {
        if (!this.lastPage) {
          this.lastPage = range.end / 2;
        }
        if (range.start > this.lastPage) {
          this.lastPage = this.lastPage * 2;
          this._fetchNextPage();
        }
      })
    );
    return this.dataStream;
  }

  disconnect(): void {
    this.subscription.unsubscribe();
  }

  private _fetchNextPage(): void {
    this.pageIndex++;
    this.appliedFilters$.next({
      ...this.selectedFilters,
      limit: this.defaultLimit,
      skip: this.defaultLimit * this.pageIndex
    });
  }

  activities$: Observable<Activity[]>;

  selectedFilters: ActivityFilter = {
    identifier: undefined,
    action: undefined,
    resource: {
      name: undefined,
      documentId: undefined
    },
    date: {
      begin: undefined,
      end: undefined
    },
    limit: this.defaultLimit,
    skip: undefined
  };

  dataSource: IndexComponent;

  appliedFilters$ = new BehaviorSubject<ActivityFilter>(this.selectedFilters);

  maxDate = new Date();

  constructor(private activityService: ActivityService) {
    super();
    this.dataSource = this;

    //push buckets
    this.activityService
      .getDocuments("bucket")
      .toPromise()
      .then(buckets => {
        buckets.forEach(id => {
          this.moduleGroups[0].modules.push(`Bucket_${id}`);
        });
      });

    this.appliedFilters$
      .pipe(
        mergeMap(filter => {
          this.isPending = true;
          if (filter.skip) {
            return this.activityService
              .get(filter)
              .pipe(
                map(activities => {
                  return this.cachedActivities.concat(activities);
                })
              )
              .toPromise();
          } else {
            return this.activityService.get(filter).toPromise();
          }
        }),
        tap(activities => {
          {
            this.isPending = false;
            this.cachedActivities = activities;
            this.dataStream.next(this.cachedActivities);
          }
        })
      )
      .subscribe();
  }

  ngOnInit() {}

  clearFilters() {
    this.selectedFilters = {
      identifier: undefined,
      action: undefined,
      resource: {
        name: undefined,
        documentId: undefined
      },
      date: {
        begin: undefined,
        end: undefined
      },
      limit: this.defaultLimit,
      skip: undefined
    };
    this.documentIds = undefined;
    this.lastPage = 0;
    this.pageIndex = 0;
    this.appliedFilters$.next(this.selectedFilters);
  }

  applyFilters() {
    this.lastPage = 0;
    this.pageIndex = 0;
    this.selectedFilters = {...this.selectedFilters, limit: this.defaultLimit, skip: undefined};
    this.appliedFilters$.next(this.selectedFilters);
  }

  showDocuments(moduleName: string) {
    this.documentIds = undefined;
    this.activityService
      .getDocuments(moduleName)
      .toPromise()
      .then(documentIds => (this.documentIds = documentIds));
  }

  clearActivities() {
    this.activityService
      .deleteActivities(this.cachedActivities)
      .then(() => {
        this.cachedActivities = [];
        this.dataStream.next(this.cachedActivities);
      })
      .catch(res => console.log(res));
  }

  ngOnDestroy() {
    this.dataStream.unsubscribe();
    this.appliedFilters$.unsubscribe();
  }

  onIndexChange(event: any) {
    console.log(event);
  }
}
