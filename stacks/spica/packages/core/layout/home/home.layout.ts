import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, Inject, OnInit, Optional, Type, ViewChild} from "@angular/core";
import {MatSidenavContainer} from "@angular/material/sidenav";
import {BehaviorSubject, Observable} from "rxjs";
import {debounceTime, map, shareReplay, switchMap, tap} from "rxjs/operators";
import {Route, RouteCategory, RouteService} from "../../route";
import {LAYOUT_ACTIONS, LAYOUT_INITIALIZER} from "../config";

@Component({
  selector: "layout-home",
  templateUrl: "home.layout.html",
  styleUrls: ["home.layout.scss"],
  host: {
    "[class.expanded]": "expanded"
  }
})
export class HomeLayoutComponent implements OnInit {
  @ViewChild(MatSidenavContainer, {static: true}) sidenav: MatSidenavContainer;

  expanded = true;
  DEFAULT_DISPLAY_TYPE = "row";
  routes$: Observable<{
    [propValue: string]: Route[];
  }>;
  categoryExpandStatus: {[propValue: string]: boolean} = {};
  isSidebarReady: boolean = false;
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall])
    .pipe(
      debounceTime(200),
      map(result => result.matches)
    );

  private _categories = new Map([
    [
      RouteCategory.Primary,
      {icon: "stars", index: 0, children: {name: RouteCategory.Primary_Sub, icon: "list"}}
    ],
    [
      RouteCategory.Dashboard,
      {icon: "dashboard", index: 0, children: {name: RouteCategory.Dashboard_Sub, icon: "list"}}
    ],
    [
      RouteCategory.Content,
      {
        icon: "view_stream",
        index: 1,
        children: {name: RouteCategory.Content_Sub, icon: "format_list_numbered"}
      }
    ],
    [
      RouteCategory.System,
      {
        icon: "supervisor_account",
        index: 2,
        children: {name: RouteCategory.System_Sub, icon: "list"}
      }
    ],
    [
      RouteCategory.Developer,
      {icon: "memory", index: 3, children: {name: RouteCategory.Developer_Sub, icon: "bug_report"}}
    ],
    [
      RouteCategory.Webhook,
      {icon: "webhook", index: 4, children: {name: RouteCategory.Webhook_Sub, icon: "bug_report"}}
    ]
  ]);

  categories$: Observable<
    Array<{icon: string; category: RouteCategory; index: number; children: object}>
  >;

  currentCategory = new BehaviorSubject(null);

  constructor(
    public routeService: RouteService,
    private breakpointObserver: BreakpointObserver,
    @Optional()
    @Inject(LAYOUT_ACTIONS)
    public components: {component: Component; position: "left" | "right" | "center"}[],
    @Optional() @Inject(LAYOUT_INITIALIZER) private initializer: Function[]
  ) {
    this.categories$ = this.routeService.routes.pipe(
      map(routes => {
        const categoryNames = Array.from(this._categories.keys());
        const categories = categoryNames
          .map(categoryName => {
            this.isSidebarReady = true;
            const category = this._categories.get(categoryName);
            return {
              icon: category.icon,
              category: categoryName,
              index: category.index,
              children: {
                items: routes.filter(route => route.category == category.children.name),
                icon: category.children.icon
              }
            };
          })
          .sort((a, b) => a.index - b.index);
        if (!this.currentCategory.value) {
          this.currentCategory.next(categories[0]);
        }

        return categories;
      })
    );
    this.routes$ = this.currentCategory.pipe(
      switchMap(currentCategory => {
        if (!this.expanded) {
          this.toggle();
        }
        return this.routeService.routes.pipe(
          map(routes => routes.filter(r => r.category == currentCategory.category))
        );
      }),
      map(routes => routes.sort((a, b) => a.index - b.index)),
      map(routes => this.groupBy(routes, "resource_category"))
    );
  }

  ngOnInit(): void {
    if (!this.initializer) {
      return;
    }
    this.initializer.forEach(fn => fn.call(fn));
  }

  toggle(): void {
    this.expanded = !this.expanded;
  }

  filterArrayByDisplay(array: [], value: any) {
    return array.filter(item => (item["displayType"] || this.DEFAULT_DISPLAY_TYPE) == value);
  }
  filterComponentsByPosition(position: string = "right") {
    return this.components.filter(component => component.position == position);
  }
  sortedByCategory(data) {
    let categoryOrders = localStorage.getItem(
      this.currentCategory.value.category + "-category-order"
    )
      ? JSON.parse(localStorage.getItem(this.currentCategory.value.category + "-category-order"))
      : [];

    return data.sort((a, b) => {
      const firstOrder = categoryOrders.find(category => category.name == a.key) || {order: 100};
      const secondOrder = categoryOrders.find(category => category.name == b.key) || {order: 100};
      return firstOrder.order - secondOrder.order;
    });
  }
  groupBy = (xs, key) => {
    return xs.reduce((rv, x) => {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  };
}
