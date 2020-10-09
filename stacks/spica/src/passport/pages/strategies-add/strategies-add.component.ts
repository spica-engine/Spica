import {Component, OnDestroy, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {NgModel} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";
import {ICONS} from "@spica-client/material";
import {Subject} from "rxjs";
import {filter, switchMap, takeUntil} from "rxjs/operators";
import {emptyStrategy, Strategy} from "../../interfaces/strategy";
import {StrategyService} from "../../services/strategy.service";

@Component({
  selector: "strategies-add",
  templateUrl: "./strategies-add.component.html",
  styleUrls: ["./strategies-add.component.scss"]
})
export class StrategiesAddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;

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
        switchMap(params => this.strategyService.getStrategy(params.id))
      )
      .subscribe(strategy => {
        this.callbackUrl = strategy.callbackUrl;
        delete strategy.callbackUrl;
        this.strategy = strategy;
      });
  }

  submitForm(certificate: NgModel) {
    (this.strategy._id
      ? this.strategyService.updateStrategy(this.strategy._id, this.strategy)
      : this.strategyService.addStrategy(this.strategy)
    )
      .toPromise()
      .then(() => this.router.navigate(["passport/strategies"]))
      .catch(() => {
        certificate.control.setErrors({invalid: true});
        certificate.control.markAsTouched();
      });
  }

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
