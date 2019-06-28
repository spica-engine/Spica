import {Component, OnInit, ViewChild, OnDestroy} from "@angular/core";
import {NgModel} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";
import {ICONS} from "@spica-client/material";
import {Subject} from "rxjs";
import {filter, switchMap, takeUntil} from "rxjs/operators";
import {emptyStrategy, EMPTY_STRATEGY, Strategy} from "../../interfaces/strategy";
import {StrategyService} from "../../strategy.service";

@Component({
  selector: "strategies-add",
  templateUrl: "./strategies-add.component.html",
  styleUrls: ["./strategies-add.component.scss"]
})
export class StrategiesAddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar;

  readonly icons: Array<string> = ICONS;
  readonly iconPageSize = 21;
  public visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  strategy: Strategy = emptyStrategy();
  callbackUrl: string;
  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private strategyService: StrategyService
  ) {}

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        takeUntil(this.onDestroy),
        switchMap(params => this.strategyService.getStrategy(params.id).toPromise())
      )
      .subscribe(strategyData => {
        this.callbackUrl = strategyData.callbackUrl;
        delete strategyData.callbackUrl;
        this.strategy = {...EMPTY_STRATEGY, ...strategyData};
      });
  }

  submitForm(certificate: NgModel) {
    this.strategyService
      .updateStrategy(this.strategy)
      .toPromise()
      .then(() => this.router.navigate(["passport/strategies"]))
      .catch(err => {
        certificate.control.setErrors({invalid: true});
      });
  }

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
