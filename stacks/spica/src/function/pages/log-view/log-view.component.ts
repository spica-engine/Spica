import {animate, state, style, transition, trigger} from "@angular/animations";
import {Component, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {BehaviorSubject, combineLatest, forkJoin, Observable} from "rxjs";
import {switchMap, tap, map} from "rxjs/operators";
import {Function, Log, LogFilter} from "../../../function/interface";
import {FunctionService} from "../../function.service";

@Component({
  selector: "log-view",
  templateUrl: "./log-view.component.html",
  styleUrls: ["./log-view.component.scss"],
  animations: [
    trigger("detail", [
      state("collapsed", style({height: "0px", padding: "0px", minHeight: "0px"})),
      state("expanded", style({height: "*", paddingTop: "10px", paddingBottom: "10px"})),
      transition("expanded <=> collapsed", animate("225ms cubic-bezier(0.4, 0.0, 0.2, 1)"))
    ])
  ]
})
export class LogViewComponent implements OnInit {
  displayedColumns: string[] = ["timestamp", "content"];

  expandedLog: Log;

  logs$: Observable<Log[]>;

  functions$: Observable<Function[]>;

  maxDate = new Date();

  selectedFunctions: string[];

  filter$ = new BehaviorSubject<LogFilter>({
    functions: []
  });

  constructor(private route: ActivatedRoute, private fs: FunctionService) {}

  ngOnInit() {
    this.functions$ = this.fs.getFunctions();
    this.logs$ = combineLatest(
      this.filter$.pipe(
        map(filter => {
          filter.end = new Date((filter.end ? filter.end : new Date()).setHours(23, 59, 59, 999));
          filter.begin = new Date((filter.begin ? filter.begin : new Date()).setHours(0, 0, 0, 0));
          return filter;
        })
      ),
      this.route.queryParamMap.pipe(
        tap(params => (this.filter$.value.functions = params.getAll("function")))
      )
    ).pipe(
      tap(([filter]) => {
        const functionColumnIndex = this.displayedColumns.indexOf("function");
        if (filter.functions.length > 1 && functionColumnIndex == -1) {
          this.displayedColumns.splice(1, 0, "function");
        } else if (filter.functions.length <= 1 && functionColumnIndex != -1) {
          this.displayedColumns.splice(functionColumnIndex, 1);
        }
      }),
      switchMap(([filter]) => this.fs.getLogs(filter))
    );
  }

  clearLogs() {
    const visibleFunctionsIds = this.filter$.value.functions;
    forkJoin(...visibleFunctionsIds.map(id => this.fs.clearLogs(id)))
      .pipe(
        tap({
          complete: () => this.filter$.next(this.filter$.value)
        })
      )
      .toPromise();
  }
}
