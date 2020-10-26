import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {IndexResult} from "@spica-client/core/interfaces";
import {MatAwareDialogModule} from "@spica-client/material/aware-dialog";
import {of} from "rxjs";
import {Webhook} from "../../interface";
import {WebhookService} from "../../webhook.service";
import {WebhookIndexComponent} from "../webhook-index/webhook-index.component";
import {MatButtonModule} from "@angular/material/button";
import {CanInteractDirectiveTest} from "../../../passport/directives/can-interact.directive";

describe("Webhook Index", () => {
  let fixture: ComponentFixture<WebhookIndexComponent>;
  let webhookService: jasmine.SpyObj<WebhookService>;

  beforeEach(async () => {
    webhookService = jasmine.createSpyObj("WebhookService", ["getAll", "delete"]);
    webhookService.getAll.and.callFake((limit, skip) => {
      let data = new Array(20).fill(null).map(
        (_, i) =>
          ({
            _id: String(i),
            trigger: {
              name: "database",
              active: true,
              options: {collection: "test_collection", type: "INSERT"}
            },
            body: "",
            url: "test_url"
          } as Webhook)
      );

      if (skip) {
        data = data.slice(skip);
      }
      if (limit) {
        data = data.slice(0, limit);
      }
      return of({meta: {total: 20}, data} as IndexResult<Webhook>);
    });

    TestBed.configureTestingModule({
      imports: [
        MatPaginatorModule,
        RouterTestingModule,
        MatTableModule,
        MatIconModule,
        MatToolbarModule,
        MatCardModule,
        NoopAnimationsModule,
        MatAwareDialogModule,
        MatButtonModule
      ],
      declarations: [WebhookIndexComponent, CanInteractDirectiveTest],
      providers: [
        {
          provide: WebhookService,
          useValue: webhookService
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WebhookIndexComponent);
    fixture.detectChanges();
  });

  it("should render webhooks", async () => {
    expect(webhookService.getAll).toHaveBeenCalledTimes(1);
    expect(webhookService.getAll).toHaveBeenCalledWith(10, 0);

    const id = fixture.debugElement.query(By.css("mat-table mat-cell:nth-of-type(1)"));
    const url = fixture.debugElement.query(By.css("mat-table mat-cell:nth-of-type(2)"));

    expect(id.nativeElement.textContent).toBe("0");
    expect(url.nativeElement.textContent).toBe("test_url");
  });

  it("should advance to the next page", async () => {
    const paginator = fixture.debugElement
      .query(By.directive(MatPaginator))
      .injector.get(MatPaginator);
    paginator.nextPage();
    fixture.detectChanges();

    expect(webhookService.getAll).toHaveBeenCalledTimes(2);
    expect(webhookService.getAll.calls.argsFor(1)).toEqual([10, 10]);

    const id = fixture.debugElement.query(By.css("mat-table mat-cell:nth-of-type(1)"));
    const url = fixture.debugElement.query(By.css("mat-table mat-cell:nth-of-type(2)"));

    expect(id.nativeElement.textContent).toBe("10");
    expect(url.nativeElement.textContent).toBe("test_url");
  });

  it("should delete webhook", fakeAsync(() => {
    webhookService.delete.and.returnValue(of(null));
    fixture.componentInstance.delete("0");
    tick();
    expect(webhookService.getAll).toHaveBeenCalledTimes(2);
    expect(webhookService.delete).toHaveBeenCalledTimes(1);
    expect(webhookService.delete).toHaveBeenCalledWith("0");
  }));
});
