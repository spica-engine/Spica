import {animate, style, transition, trigger} from "@angular/animations";
import {Component, OnDestroy, OnInit, SecurityContext, ViewChild} from "@angular/core";
import {MatPaginator, PageEvent} from "@angular/material/paginator";
import {Sort} from "@angular/material/sort";
import {ActivatedRoute, Router} from "@angular/router";
import {merge, Observable, Subject} from "rxjs";
import {
  flatMap,
  map,
  publishReplay,
  refCount,
  switchMap,
  take,
  tap,
  takeUntil
} from "rxjs/operators";
import {Bucket} from "../../interfaces/bucket";
import {BucketData, BucketEntry} from "../../interfaces/bucket-entry";
import {BucketSettings} from "../../interfaces/bucket-settings";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketService} from "../../services/bucket.service";
import {DomSanitizer} from "@angular/platform-browser";
import {NgModel} from "@angular/forms";
import {Scheme, SchemeObserver} from "@spica-client/core";

@Component({
  selector: "bucket-data-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"],
  animations: [
    trigger("smooth", [
      transition(":enter", [style({opacity: 0}), animate("0.5s ease-out", style({opacity: 1}))]),
      transition(":leave", [style({opacity: 1}), animate("0.5s ease-in", style({opacity: 0}))])
    ])
  ]
})
export class IndexComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

  onImageError;

  templateMap = new Map<string, any>();

  dependents = [];

  selectedItemDependents = [];

  bucketId: string;
  schema$: Observable<Bucket>;
  data$: Observable<BucketData>;
  refresh = new Subject();
  loaded: boolean;

  filter: {[key: string]: any} = {};
  sort: {[key: string]: number} = {};

  showScheduled: boolean = false;
  readOnly: boolean = true;

  displayedProperties: Array<string> = [];
  properties: Array<{name: string; title: string}> = [];

  $preferences: Observable<BucketSettings>;
  language: string;
  selectedItems: Array<BucketEntry> = [];
  dataIds: Array<string> = [];

  guide: boolean = false;
  guideResponse: {[key: string]: string};
  guideObjects: object;
  rootUrl: string;

  readonly defaultPaginatorOptions = {
    pageSize: 10,
    pageIndex: 0,
    length: 0
  };

  editableProps = [];

  copyEntries = [];

  editingCellId;

  nonEditableTypes = ["storage", "relation", "richtext"];
  dispose = new Subject();

  constructor(
    private bs: BucketService,
    private bds: BucketDataService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private scheme: SchemeObserver
  ) {
    this.scheme
      .observe(Scheme.Dark)
      .pipe(takeUntil(this.dispose))
      .subscribe(isDark => {
        this.refreshOnImageErrorStyle(isDark);
        this.templateMap.clear();
      });
  }

  ngOnInit(): void {
    this.rootUrl = window.location.origin;
    this.$preferences = this.bs.getPreferences();

    this.schema$ = this.route.params.pipe(
      tap(params => {
        this.bucketId = params.id;
        this.showScheduled = false;

        this.filter = {};
        this.sort = {};
        this.paginator.pageIndex = this.defaultPaginatorOptions.pageIndex;
        this.paginator.pageSize = this.defaultPaginatorOptions.pageSize;
        this.paginator.length = this.defaultPaginatorOptions.length;
      }),
      flatMap(() => this.bs.getBucket(this.bucketId)),
      tap(schema => {
        this.guideResponse = {};
        this.readOnly = schema.readOnly;
        this.properties = [
          {name: "$$spicainternal_id", title: "_id"},
          ...Object.entries(schema.properties).map(([name, value]) => ({
            name,
            title: value.title
          })),
          {name: "$$spicainternal_schedule", title: "Scheduled"},
          {name: "$$spicainternal_actions", title: "Actions"}
        ];

        this.editableProps = Object.entries(schema.properties)
          .filter(([k, v]) => !this.nonEditableTypes.includes(v.type))
          .map(([k, v]) => k);

        if (!schema.readOnly) {
          this.properties.unshift({name: "$$spicainternal_select", title: "Select"});
        }

        const cachedDisplayedProperties = JSON.parse(
          localStorage.getItem(`${this.bucketId}-displayedProperties`)
        );

        //eliminate the properties which are not included by schema
        this.displayedProperties = cachedDisplayedProperties
          ? cachedDisplayedProperties.filter(dispProps =>
              Object.keys(schema.properties)
                .concat([
                  "$$spicainternal_id",
                  "$$spicainternal_schedule",
                  "$$spicainternal_actions",
                  "$$spicainternal_select"
                ])
                .some(schemaProps => schemaProps == dispProps)
            )
          : [
              schema.primary || Object.keys(schema.properties)[0] || "$$spicainternal_id",
              "$$spicainternal_actions"
            ];
      }),
      tap(schema => {
        Object.keys(schema.properties).map(key => {
          if (schema.properties[key].type == "relation") {
            this.bs
              .getBucket(schema.properties[key]["bucketId"])
              .pipe(take(1))
              .subscribe(bucket => (schema.properties[key]["primary"] = bucket.primary));
          }
        });
      }),
      publishReplay(),
      refCount()
    );

    this.data$ = merge(this.route.params, this.route.queryParams, this.refresh).pipe(
      tap(() => (this.loaded = false)),
      switchMap(params => {
        if (
          params &&
          (params["filter"] || params["paginator"] || params["sort"] || params["language"])
        ) {
          let paginationChanges: PageEvent = JSON.parse(params["paginator"]);
          this.paginator.pageIndex = paginationChanges.pageIndex;
          this.paginator.pageSize = paginationChanges.pageSize;
          this.paginator.length = paginationChanges.length;

          this.filter = JSON.parse(params["filter"]);
          this.sort = JSON.parse(params["sort"]);
          this.language = params["language"];
        }

        return this.bds.find(this.bucketId, {
          language: this.language,
          filter: this.filter && Object.keys(this.filter).length > 0 && this.filter,
          sort: Object.keys(this.sort).length > 0 ? this.sort : {_id: -1},
          limit: this.paginator.pageSize || 10,
          skip: this.paginator.pageSize * this.paginator.pageIndex,
          schedule: this.showScheduled
        });
      }),
      map(response => {
        this.selectedItems = [];
        this.paginator.length = (response.meta && response.meta.total) || 0;
        this.dataIds = response.data.map(d => d._id);
        this.loaded = true;
        const bucketUrl = `/bucket/${this.bucketId}/data?`;

        setTimeout(() => {
          const usableProperties = this.properties.filter(
            prop => !prop.name.startsWith("$$spicainternal_")
          );

          const firstProp = usableProperties[0] ? usableProperties[0].name : undefined;
          const secondProp = usableProperties[1] ? usableProperties[1].name : undefined;
          const firstPropValue =
            response.data.length && firstProp ? response.data[0][firstProp] : "";
          const secondPropValue =
            response.data.length && secondProp ? response.data[0][secondProp] : "";
          this.guideObjects = {
            getAllWithLimit: {
              title: "Get Limited Data",
              description:
                "To get all data using limits, simply you can add 'limit' [number] parameter as query params. You can try the live demo below.",
              url: `${bucketUrl}limit=3`
            },
            getAllWithSort: {
              title: "Get Limited Data With Sorting",
              description:
                "To sort your dataset, you can add 'sort' [object] parameter as query params. You can try the live demo below. ",
              url: `${bucketUrl}limit=3&sort={"${firstProp}":1}`
            },
            getWithFilterMongoDb: {
              title: "Get Filtered Data (MongoDB Match Aggregation)",
              description:
                "To filter your data, you can use MongoDB match aggregations in 'filter' [object] query parameter. You can try the live demo below.",
              url: `${bucketUrl}limit=3&filter={"${firstProp}":{"$regex":"${firstPropValue}"}}`
            },
            getWithFilterRulesEngine: {
              title: "Get Filtered Data (Spica Rules Engine) ",
              description:
                "To filter your data, you can use built-in 'Spica Rules' engine in 'filter' [string] query parameter. You can try the live demo below.",
              url: `${bucketUrl}limit=3&filter=${firstProp}=='${firstPropValue}'`
            },
            getWithDoubleFilter: {
              title: "Using Double Filter",
              description:
                "You can apply double filter to your requests as well. You can try the live demo below.",
              url: `${bucketUrl}limit=1&filter={"${firstProp}":{"$regex":"${firstPropValue}"},"${secondProp}":{"$regex":"${secondPropValue}"}}`
            },
            getOnlyScheduled: {
              title: "Get Scheduled Data",
              description:
                "You can get all scheduled data with using 'shcedule' [boolean] query parameter. You can try the live demo below.",
              url: `${bucketUrl}?limit=3&schedule=true`
            },
            getDataWithLang: {
              title: "Get Localized Data",
              description:
                "To get localized data, you can use 'Accept-Language' request header. As an example '{Accept-Language: \"en-EN\"}'",
              url: ``
            }
          };
        }, 1000);

        return response.data;
      }),
      tap(entries => (this.copyEntries = JSON.parse(JSON.stringify(entries))))
    );
  }

  ngOnDestroy() {
    this.dispose.next();
  }

  getDependents(schema: Bucket, entries: BucketEntry[]) {
    const dependents = new Set();

    for (const [name, definition] of Object.entries(schema.properties)) {
      for (const entry of entries) {
        if (definition.type == "relation" && definition["dependent"] && entry[name]) {
          const documents = Array.isArray(entry[name]) ? entry[name] : [entry[name]];

          for (const document of documents) {
            const text = `${definition["bucketId"]}/${document._id}`;
            dependents.add(text);
          }
        }
      }
    }

    return Array.from(dependents);
  }

  onItemSelected(isSelect: boolean, data: BucketEntry) {
    if (isSelect) {
      this.selectedItems.push(data);
    } else {
      this.selectedItems.splice(this.selectedItems.findIndex(entry => entry._id == data._id), 1);
    }
  }

  hasSelected(id: string) {
    return this.selectedItems.findIndex(item => item._id == id) != -1;
  }

  toggleDisplayAll(display: boolean, schema: Bucket) {
    if (display) {
      this.displayedProperties = [
        "$$spicainternal_select",
        "$$spicainternal_id",
        ...Object.keys(schema.properties),
        "$$spicainternal_schedule",
        "$$spicainternal_actions"
      ];
    } else {
      this.displayedProperties = [schema.primary, "$$spicainternal_actions"];
    }
    localStorage.setItem(
      `${this.bucketId}-displayedProperties`,
      JSON.stringify(this.displayedProperties)
    );
  }

  toggleProperty(name: string, selected: boolean) {
    if (selected) {
      this.displayedProperties.push(name);
    } else {
      this.displayedProperties.splice(this.displayedProperties.indexOf(name), 1);
    }
    this.displayedProperties = this.displayedProperties.sort(
      (a, b) =>
        this.properties.findIndex(p => p.name == a) - this.properties.findIndex(p => p.name == b)
    );
    localStorage.setItem(
      `${this.bucketId}-displayedProperties`,
      JSON.stringify(this.displayedProperties)
    );
  }

  toggleScheduled() {
    this.showScheduled = !this.showScheduled;
    let displayScheduleIndex = this.displayedProperties.indexOf("$$spicainternal_schedule");
    if (displayScheduleIndex > -1 && !this.showScheduled) {
      this.displayedProperties.splice(displayScheduleIndex, 1);
    }
    if (displayScheduleIndex == -1 && this.showScheduled) {
      let lastIndex = this.displayedProperties.lastIndexOf("$$spicainternal_actions");
      this.displayedProperties.splice(lastIndex, 0, "$$spicainternal_schedule");
    }
    localStorage.setItem(
      `${this.bucketId}-displayedProperties`,
      JSON.stringify(this.displayedProperties)
    );
    this.refresh.next();
  }

  onSortChange(sort: Sort) {
    if (sort.direction) {
      this.sort = {
        [sort.active.replace("$$spicainternal", "")]: sort.direction === "asc" ? 1 : -1
      };
    } else {
      this.sort = {};
    }

    this.router.navigate([], {
      queryParams: {
        filter: JSON.stringify(this.filter),
        paginator: JSON.stringify({
          pageSize: this.paginator.pageSize,
          pageIndex: this.paginator.pageIndex,
          length: this.paginator.length
        }),
        sort: JSON.stringify(this.sort),
        language: this.language
      }
    });
  }

  onPaginatorChange(changes: PageEvent) {
    this.router.navigate([], {
      queryParams: {
        paginator: JSON.stringify(changes),
        filter: JSON.stringify(this.filter),
        sort: JSON.stringify(this.sort),
        language: this.language
      }
    });
  }

  onFilterChange(changes: object) {
    this.router.navigate([], {
      queryParams: {
        filter: JSON.stringify(changes),
        paginator: JSON.stringify(this.defaultPaginatorOptions),
        sort: JSON.stringify(this.sort),
        language: this.language
      }
    });
  }

  onLanguageChange(language: string) {
    this.router.navigate([], {
      queryParams: {
        filter: JSON.stringify(this.filter),
        paginator: JSON.stringify(this.defaultPaginatorOptions),
        sort: JSON.stringify(this.sort),
        language: language
      }
    });
  }

  patchBucketData(bucketid: string, documentid: string, key: string, value: any) {
    const patch = {[key]: value == undefined ? null : value};

    return this.bds
      .patchOne(bucketid, documentid, patch)
      .toPromise()
      .finally(() => this.refresh.next());
  }

  delete(id: string): void {
    this.bds
      .delete(this.bucketId, id)
      .toPromise()
      .then(() => this.refresh.next());
  }

  deleteSelectedItems() {
    this.bds
      .deleteMany(this.bucketId, this.selectedItems.map(i => i._id))
      .toPromise()
      .then(() => this.refresh.next());
  }

  guideRequest(url: string, key: string) {
    if (!this.guideResponse[key]) {
      this.bs
        .guideRequest(url, key == "getDataWithLang" ? {headers: {"Accept-Language": "tr-TR"}} : {})
        .pipe(take(1))
        .subscribe(returnedData => {
          this.guideResponse[key] = returnedData;
        });
    } else {
      this.guideResponse[key] = undefined;
    }
  }

  buildTemplate(value, property, name) {
    const key = `${name}_${typeof value == "object" ? JSON.stringify(value) : value}`;

    if (this.templateMap.has(key)) {
      return this.templateMap.get(key);
    }

    let result;
    let defs;
    let newValue;
    let style;
    let props;

    switch (property.type) {
      case "object":
        newValue = JSON.stringify(value);

        defs = this.getDefaulHtmlDefs(newValue);

        result = this.buildHtml(defs);

        break;

      case "date":
        newValue = new Date(value).toLocaleString();

        defs = this.getDefaulHtmlDefs(newValue);

        result = this.buildHtml(defs);

        break;

      case "color":
        style = {
          display: "inline-block",
          width: "20px",
          height: "20px",
          "background-color": value,
          "border-radius": "3px"
        };

        result = this.buildHtml({
          name: "div",
          style
        });

        break;

      case "relation":
        if (this.isValidOnetoMany(property, value)) {
          newValue = value.map(val =>
            val.hasOwnProperty(property.primary) ? val[property.primary] : val
          );
        } else if (this.isValidOnetoOne(property, value)) {
          newValue = value.hasOwnProperty(property.primary) ? value[property.primary] : value;
        }

        defs = this.getDefaulHtmlDefs(newValue);

        result = this.buildHtml(defs);

        break;

      case "storage":
        if (!this.isValidValue(value)) {
          defs = this.getDefaulHtmlDefs(value);

          result = this.buildHtml(defs);
        } else {
          style = {
            width: "100px",
            height: "100px",
            margin: "10px",
            "border-radius": "3px"
          };

          props = {
            src: value,
            alt: value,
            onerror: this.onImageError
          };

          result = this.buildHtml({name: "img", style, props, noEndTag: true});
        }

        break;

      case "location":
        newValue = value ? [value.coordinates[1], value.coordinates[0]] : [];

        defs = this.getDefaulHtmlDefs(newValue);

        result = this.buildHtml(defs);

        break;

      default:
        defs = this.getDefaulHtmlDefs(value);

        result = this.buildHtml(defs);
        break;
    }

    this.templateMap.set(key, result);

    return result;
  }

  getDefaulHtmlDefs(value: any) {
    return {
      name: "div",
      style: {
        display: "inline-block",
        "min-width": "20px"
      },
      value
    };
  }

  buildHtml(options: {
    name: string;
    style: object;
    props?: object;
    noEndTag?: boolean;
    value?: string;
  }) {
    const style = Object.entries(options.style)
      .map(([key, value]) => `${key}:${value}`)
      .join(";");

    const props = Object.entries(options.props || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");

    const html = options.noEndTag
      ? `<${options.name} style='${style}' ${props}>`
      : `<${options.name} style='${style}' ${props}>${
          this.isValidValue(options.value)
            ? this.sanitizer.sanitize(SecurityContext.HTML, options.value)
            : ""
        }</${options.name}>`;

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  isValidValue(val) {
    return val != undefined && val != null;
  }

  isValidOnetoMany(property, value) {
    return property.relationType == "onetomany" && Array.isArray(value);
  }

  isValidOnetoOne(property, value) {
    return property.relationType == "onetoone" && typeof value == "object";
  }

  // inline editing methods
  getEditingCellId(id: string, key: string) {
    return `${id}_${key}`;
  }

  enableEditMode(id: string, key: string) {
    this.editingCellId = this.getEditingCellId(id, key);
  }

  editNext(id: string, key: string) {
    const fields = this.editableProps.filter(p => this.displayedProperties.includes(p));

    let nextDataId = id;
    let nextField = fields[fields.indexOf(key) + 1];

    if (!nextField) {
      const dataIds = this.copyEntries.map(v => v._id);

      nextDataId = dataIds[dataIds.indexOf(id) + 1];

      if (!nextDataId) {
        return;
      }

      nextField = this.editableProps[0];
    }

    this.enableEditMode(nextDataId, nextField);

    this.focusManually(nextDataId, nextField);
  }

  focusManually(id: string, key: string) {
    // temporary fix
    setTimeout(() => {
      const el = document.getElementById(this.getEditingCellId(id, key));
      if (el) {
        const input = el.querySelector(".mat-input-element") as HTMLElement;
        if (input) {
          input.focus();
        }
      }
    }, 1000);
  }

  revertEditModeChanges(id: string, key: string, model: NgModel) {
    const previousValue = this.copyEntries.find(v => id == v._id)[key];

    model.control.setValue(previousValue);
  }

  refreshOnImageErrorStyle(isDark: boolean) {
    const src = "assets/image_not_supported.svg";

    const width = "30px";
    const height = "30px";

    const marginVertical = "10px";
    const marginHorizontal = "45px";

    const filter = `invert(${isDark ? 100 : 0}%)`;

    this.onImageError = `this.src='${src}';this.style.width='${width}';this.style.height='${height}';this.style.marginLeft='${marginHorizontal}';this.style.marginRight='${marginHorizontal}';this.style.marginTop='${marginVertical}';this.style.marginBottom='${marginVertical}';this.style.filter='${filter}';`;
  }
}
