import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  ViewChild,
  Renderer2,
  ChangeDetectorRef,
  RendererStyleFlags2,
  Inject
} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {SavingState} from "@spica-client/material";
import {merge, Observable, of, Subject, throwError, BehaviorSubject} from "rxjs";
import {
  catchError,
  delay,
  endWith,
  filter,
  flatMap,
  ignoreElements,
  map,
  share,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap
} from "rxjs/operators";
import {FunctionService} from "../../services/function.service";
import {
  denormalizeFunction,
  emptyFunction,
  emptyTrigger,
  FunctionOptions,
  FUNCTION_OPTIONS,
  Information,
  NormalizedFunction,
  normalizeFunction,
  Trigger
} from "../../interface";
import {MatDialog} from "@angular/material/dialog";
import {ExampleComponent} from "@spica-client/common/example";
import {GithubService} from "@spica-client/function/services";
import {RepositoryComponent} from "../../components/repository/repository.component";
import {ConfigurationComponent} from "../../components/configuration/configuration.component";

@Component({
  selector: "functions-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})
export class AddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar;

  $refresh = new Subject();

  function: NormalizedFunction = emptyFunction();

  selectedFunctionId = new BehaviorSubject(undefined);

  information: Observable<Information>;

  dependencies: Observable<any>;
  dependencyInstallPending = false;

  isHandlerDuplicated = false;
  serverError: string;

  private dispose = new EventEmitter();

  realtimeConnectionTime = new Date();

  editorOptions = {
    language: "javascript",
    minimap: {enabled: false},
    automaticLayout: true,
    scrollbar: {alwaysConsumeMouseWheel: false}
  };

  isIndexPending = false;

  index: string;
  $indexSave: Observable<Date | "inprogress">;

  $save: Observable<SavingState>;

  $markers = new Subject<unknown[]>();

  triggersEditMode = [];

  sections = {
    triggers: true,
    dependencies: false,
    envs: false,
    optionals: false
  };
  editName = false;
  editDescription = false;

  apiUrl;

  lastSavedIndex;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private functionService: FunctionService,
    private http: HttpClient,
    public dialog: MatDialog,
    public renderer: Renderer2,
    public changeDetector: ChangeDetectorRef,
    private github: GithubService,
    @Inject(FUNCTION_OPTIONS) options: FunctionOptions
  ) {
    this.apiUrl = options.url;
    this.information = this.functionService.information().pipe(
      share(),
      tap(information => {
        this.function.timeout = this.function.timeout || information.timeout * 0.1;
      })
    );
  }

  ngOnInit() {
    if (this.github.token) {
      this.initGithub();
    }

    merge(
      this.$refresh,
      this.activatedRoute.params.pipe(
        tap(params => {
          if (!params.id) {
            this.onInfoViewSelectionChange(false);
            this.dialog
              .open(ConfigurationComponent, {
                disableClose: true,
                minWidth: "200px",
                width: "40%",
                maxWidth: "1000px",
                maxHeight: "90vh",
                data: {
                  information: this.information,
                  function: this.function,
                  apiUrl: this.apiUrl
                }
              })
              .afterClosed()
              .toPromise()
              .then(save => {
                this.onInfoViewSelectionChange(true);

                if (!save) {
                  this.function = emptyFunction();
                  return;
                }

                const code = this.functionService.getExample(this.function.triggers[0]);
                this.index = code;
                this.save();
              });
          }
        }),
        filter(params => params.id),
        map(params => params.id)
      )
    )
      .pipe(
        tap(id => this.selectedFunctionId.next(id)),
        switchMap(id => this.functionService.getFunction(id).pipe(take(1))),
        tap(fn => {
          this.dependencyInstallPending = false;
          this.serverError = undefined;
          this.isIndexPending = true;
          this.$save = of(SavingState.Pristine);
          this.function = normalizeFunction(fn);
          for (const [index, trigger] of this.function.triggers.entries()) {
            this.triggersEditMode[index] = false;
          }
          this.getDependencies();
        }),
        switchMap(fn => this.functionService.getIndex(fn._id)),
        takeUntil(this.dispose)
      )
      .subscribe(
        response => {
          this.isIndexPending = false;
          this.index = response.index;
          this.updateLastSavedIndex();
        },
        () => (this.isIndexPending = false)
      );
  }

  ngOnDestroy() {
    this.dispose.emit();
  }

  formatTimeout(value: number) {
    if (value >= 60) {
      return (Math.round((value / 60) * 100 + Number.EPSILON) / 100).toFixed(1) + "m";
    }
    return `${value}s`;
  }

  addTrigger() {
    this.function.triggers.push(emptyTrigger());
    this.triggersEditMode[this.function.triggers.length - 1] = true;
  }

  deleteTrigger(i: number) {
    this.function.triggers.splice(i, 1);
    this.triggersEditMode.splice(i, 1);
    this.checkHandlers();
  }

  addVariable() {
    this.function.env.push({value: undefined, key: undefined});
  }

  removeVariable(index: number) {
    this.function.env.splice(index, 1);
  }

  showExample(trigger: Trigger) {
    const code = this.functionService.getExample(trigger);
    this.dialog.open(ExampleComponent, {
      width: "80%",
      data: {
        code: code
      }
    });
  }

  updateIndex() {
    if (this.isIndexPending) return;

    if (this.function._id) {
      this.$markers.next([]);
      this.$indexSave = this.functionService.updateIndex(this.function._id, this.index).pipe(
        startWith("inprogress"),
        endWith(new Date()),
        delay(300),
        catchError(error => {
          if (error.status == 422) {
            this.$markers.next(
              error.error.map(diagnostic => ({
                message: diagnostic.text,
                code: `TS-${diagnostic.code}`,
                startLineNumber: diagnostic.start.line,
                startColumn: diagnostic.start.column,
                endLineNumber: diagnostic.end.line,
                endColumn: diagnostic.end.column
              }))
            );
            return of(new Date());
          }
          return throwError(error);
        }),
        tap(() => this.updateLastSavedIndex())
      ) as Observable<Date | "inprogress">;
    }
  }

  save() {
    if (this.isIndexPending) return;

    this.serverError = undefined;

    const fn = denormalizeFunction(this.function);

    const isInsert = !this.function._id;

    const save = isInsert
      ? this.functionService.insertOne(fn)
      : this.functionService.replaceOne(fn);

    this.$save = merge(
      of(SavingState.Saving),
      save.pipe(
        flatMap(fn =>
          this.functionService.updateIndex(fn._id, this.index).pipe(
            catchError(error => {
              if (error.status == 422) {
                return of(error);
              }
              return throwError(error);
            }),
            tap(() => this.updateLastSavedIndex()),
            tap(() => isInsert && this.router.navigate([`function/${fn._id}`])),
            ignoreElements()
          )
        ),
        endWith(SavingState.Saved),
        catchError((err: HttpErrorResponse) => {
          this.serverError = err.error.message;
          return of(SavingState.Failed);
        })
      )
    );
  }

  updateLastSavedIndex() {
    this.lastSavedIndex = `${this.index}`;
  }

  hasUnsavedChanges() {
    return this.lastSavedIndex != this.index;
  }

  getDependencies() {
    this.dependencies = this.http.get(`api:/function/${this.function._id}/dependencies`);
  }

  addDependency(name: string) {
    this.dependencyInstallPending = true;
    this.http
      .post(`api:/function/${this.function._id}/dependencies`, {name})
      .toPromise()
      .then(() => {
        this.getDependencies();
        this.dependencyInstallPending = false;
      })
      .catch(() => {
        this.dependencyInstallPending = false;
      });
  }

  deleteDependency(name: string) {
    this.dependencyInstallPending = true;
    this.http
      .delete(`api:/function/${this.function._id}/dependencies/${name}`)
      .toPromise()
      .then(() => {
        this.dependencies = this.http.get(`api:/function/${this.function._id}/dependencies`);
        this.dependencyInstallPending = false;
      })
      .catch(() => {
        this.dependencyInstallPending = false;
      });
  }

  checkHandlers() {
    this.isHandlerDuplicated = false;
    for (const trigger of this.function.triggers) {
      if (this.function.triggers.filter(item => item.handler == trigger.handler).length > 1) {
        this.isHandlerDuplicated = true;
        break;
      }
    }
  }

  // FULLSCREEN CODE EDITOR
  enableLogView: boolean = false;
  enableInfoView: boolean = true;
  onFullScreen: boolean = false;

  browserFullscreenKeywords = {
    open: "",
    onChange: "",
    fullScreenElement: "",
    exit: ""
  };

  async switchToFullscreen() {
    if (!this.onFullScreen) {
      if (!this.enableLogView) {
        this.enableLogView = true;
        this.changeDetector.detectChanges();
      }

      const content = document.getElementsByClassName("mat-sidenav-content").item(0);

      try {
        this.setBrowserDefaults();

        this.applyStyles();

        await this.requestFullscreen(content);

        this.onFullScreen = true;
      } catch (e) {
        this.revertStyles();
      }
    } else {
      await document[this.browserFullscreenKeywords.exit]();

      this.revertStyles();

      this.onFullScreen = false;
    }
  }

  getFullscreenElements() {
    const codeActions = document.getElementsByClassName("code-actions").item(0);
    const codeEditor = document.getElementsByClassName("editor").item(0);
    const logs = document.getElementsByClassName("sidecar-log-view").item(0);
    const content = document.getElementsByClassName("mat-sidenav-content").item(0);

    return {codeActions, codeEditor, logs, content};
  }

  applyStyles() {
    const {codeActions, codeEditor, logs, content} = this.getFullscreenElements();

    this.renderer.addClass(codeActions, "full-screen-code-actions");
    this.renderer.addClass(codeEditor, "full-screen-code");
    this.renderer.addClass(logs, "full-screen-log");
    this.renderer.setStyle(content, "margin-left", "0px", RendererStyleFlags2.Important);
  }

  revertStyles() {
    const {codeActions, codeEditor, logs, content} = this.getFullscreenElements();

    this.renderer.removeClass(codeActions, "full-screen-code-actions");
    this.renderer.removeClass(codeEditor, "full-screen-code");
    this.renderer.removeClass(logs, "full-screen-log");
    this.renderer.removeStyle(content, "margin-left");
  }

  setBrowserDefaults() {
    if (document.exitFullscreen) {
      this.browserFullscreenKeywords = {
        open: "requestFullscreen",
        onChange: "fullscreenchange",
        fullScreenElement: "fullscreenElement",
        exit: "exitFullscreen"
      };
    } else if (document["webkitExitFullscreen"]) {
      this.browserFullscreenKeywords = {
        open: "webkitRequestFullscreen",
        onChange: "webkitfullscreenchange",
        fullScreenElement: "webkitFullscreenElement",
        exit: "webkitExitFullscreen"
      };
    } else if (document["msExitFullscreen"]) {
      this.browserFullscreenKeywords = {
        open: "msRequestFullscreen",
        onChange: "msfullscreenchange",
        fullScreenElement: "msFullscreenElement",
        exit: "msExitFullscreen"
      };
    } else if (document["mozCancelFullScreen"]) {
      this.browserFullscreenKeywords = {
        open: "mozRequestFullScreen",
        onChange: "mozfullscreenchange",
        fullScreenElement: "mozFullScreenElement",
        exit: "mozCancelFullScreen"
      };
    } else {
      throw new Error("Unable to detect browser.");
    }
  }

  async requestFullscreen(element: Element): Promise<void> {
    await element[this.browserFullscreenKeywords.open]();

    const escHandler = () => {
      if (!document[this.browserFullscreenKeywords.fullScreenElement]) {
        document[this.browserFullscreenKeywords.exit]().catch(e => console.log(e));
        this.revertStyles();
        this.onFullScreen = false;
      }
    };

    document.addEventListener(this.browserFullscreenKeywords.onChange, escHandler);
  }

  // RESIZABLE LOGS
  isResizing: boolean;
  logViewHeight$: Subject<number> = new Subject();

  readonly logViewLabelHeight = 42;
  readonly logViewDefaultExpandedHeight = 410;

  onMouseMove(event: MouseEvent) {
    if (!this.isResizing) {
      return;
    }

    const logview = document.getElementsByClassName("footer-bar")[0];
    const resizeCursor = document.getElementsByClassName("resize-cursor")[0];

    const desiredHeight =
      window.innerHeight - event.clientY - resizeCursor.getBoundingClientRect().height / 2;

    logview.setAttribute("style", `height: ${desiredHeight}px !important`);

    // hide logview
    // 1px is for preventing the conflict between expand and hide moves
    if (this.enableLogView && desiredHeight <= this.logViewLabelHeight - 1) {
      this.onLogViewSelectionChange();
      this.onMouseUp();
      return;
    }
    // expand logview
    else if (!this.enableLogView && desiredHeight >= this.logViewLabelHeight) {
      this.onLogViewSelectionChange(desiredHeight);
      return;
    }

    this.logViewHeight$.next(desiredHeight - this.logViewLabelHeight);
  }

  onMouseDown() {
    this.isResizing = true;
  }

  onMouseUp() {
    this.isResizing = false;
  }

  onLogViewSelectionChange(height?: number) {
    this.enableLogView = !this.enableLogView;

    const el = document.getElementsByClassName("footer-bar")[0] as HTMLElement;

    if (!this.enableLogView) {
      el.setAttribute("style", `height:${this.logViewLabelHeight}px !important`);
      this.logViewHeight$.next(0);
    } else {
      height = height || this.logViewDefaultExpandedHeight;
      el.setAttribute("style", `height: ${height}px !important`);
      this.logViewHeight$.next(height - this.logViewLabelHeight);
    }
  }

  onInfoViewSelectionChange(state?: boolean) {
    this.enableInfoView = typeof state != "undefined" ? state : !this.enableInfoView;

    const codeSection = document.getElementsByClassName("code")[0];
    const infoSection = document.getElementsByClassName("info")[0];

    if (!this.enableInfoView) {
      this.renderer.addClass(codeSection, "code-expanded");
      this.renderer.addClass(infoSection, "info-hidden");
    } else {
      this.renderer.removeClass(codeSection, "code-expanded");
      this.renderer.removeClass(infoSection, "info-hidden");
    }
  }

  //GITHUB INTEGRATION
  repos: {repo: string; branches: string[]}[] = [];

  selectedRepoBranch: {repo: string; branch: string} = {repo: undefined, branch: undefined};

  pushStrategy: {
    target: "repo" | "branch" | "commit";
    repo: string;
    branch?: string;
    message?: string;
  } = {target: undefined, repo: undefined};

  integratedUser: {
    username: string;
    avatar_url: string;
  };

  repoPending = false;

  repoResponse: {succeeded: boolean; message: string};

  async initGithub() {
    let token = this.github.token;

    if (!token) {
      this.repoPending = true;

      let tab: Window;

      const onFailed = (reason: string) => {
        tab.close();
        this.repoPending = false;
        this.showRepoResponse({succeeded: false, message: reason});
      };

      return this.github.startOAuth().subscribe(
        res => {
          switch (res.name) {
            case "url":
              tab = window.open(res.data.url);
              break;

            case "token":
              tab.close();
              this.repoPending = false;
              this.github.token = res.data.token;
              this.initGithub();
              break;

            case "error":
              onFailed(res.data.message);
              break;

            default:
              break;
          }
        },
        e => onFailed(e)
      );
    }

    this.integratedUser = await this.github.initialize(token);
    this.repos = await this.listRepos();
    this.selectedRepoBranch = this.github.selectedRepoBranch;
  }

  disconnectGithub() {
    this.integratedUser = this.github.token = undefined;
    this.github.selectedRepoBranch = this.selectedRepoBranch = {repo: undefined, branch: undefined};
    this.repos = [];
  }

  async listRepos() {
    this.repoPending = true;
    const rps = await this.github
      .listRepos()
      .pipe(map(repos => repos.map(r => r.name)))
      .toPromise();

    return Promise.all(
      rps.map(repo =>
        this.github
          .listBranches(repo)
          .pipe(
            map(branches => {
              return {
                repo: repo,
                branches: branches.map(b => b.name)
              };
            })
          )
          .toPromise()
          .finally(() => (this.repoPending = false))
      )
    );
  }

  openRepoBranchDialog() {
    this.clearPushStrategy();

    this.dialog
      .open(RepositoryComponent, {
        width: "400px",
        maxWidth: "100%",
        data: {
          selectedRepo: this.selectedRepoBranch,
          availableRepos: this.repos,
          pushStrategy: this.pushStrategy,
          user: this.integratedUser
        }
      })
      .afterClosed()
      .toPromise()
      .then(async (action: "pull" | "push") => {
        if (action == "pull") {
          this.pull();
        } else if (action == "push") {
          await this.push();

          this.addRepoBranch({
            repo: this.pushStrategy.repo,
            branch: this.pushStrategy.branch
          });
        }
      });
  }

  clearPushStrategy() {
    this.pushStrategy.target = undefined;
    this.pushStrategy.repo = undefined;
    this.pushStrategy.branch = undefined;
    this.pushStrategy.message = undefined;
  }

  async pull() {
    this.repoPending = true;

    await this.github
      .pullCommit(this.selectedRepoBranch.repo, this.selectedRepoBranch.branch)
      .toPromise()
      .then((res: any) => {
        this.showRepoResponse({succeeded: true, message: res.message});
      })
      .finally(() => (this.repoPending = false));

    this.github.selectedRepoBranch = this.selectedRepoBranch;

    this.$refresh.next(this.function._id);
  }

  showRepoResponse(response: {succeeded: boolean; message: string}) {
    this.repoResponse = response;
    setTimeout(() => {
      this.repoResponse = undefined;
    }, 3000);
  }

  // we prefer to add a new repo or branch manually since github return responses from cache
  addRepoBranch(repoBranch: {repo: string; branch: string}) {
    const repoIndex = this.repos.findIndex(r => r.repo == repoBranch.repo);

    if (repoIndex == -1) {
      return this.repos.push({repo: repoBranch.repo, branches: [repoBranch.branch]});
    }

    const branchIndex = this.repos[repoIndex].branches.indexOf(repoBranch.branch);

    if (branchIndex == -1) {
      return this.repos[repoIndex].branches.push(repoBranch.branch);
    }
  }

  async push() {
    this.repoPending = true;
    let promise: Promise<any>;

    if (this.pushStrategy.target == "repo") {
      promise = this.github.createRepo(this.pushStrategy.repo).toPromise();
    } else if (this.pushStrategy.target == "branch" || this.pushStrategy.target == "commit") {
      promise = this.github
        .pushCommit(this.pushStrategy.repo, this.pushStrategy.branch, this.pushStrategy.message)
        .toPromise();
    }

    await promise
      .then((res: any) => this.showRepoResponse({succeeded: true, message: res.message}))
      .finally(() => (this.repoPending = false));

    this.selectedRepoBranch = this.github.selectedRepoBranch = {
      repo: this.pushStrategy.repo,
      branch: this.pushStrategy.branch
    };
  }
}
