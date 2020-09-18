import {ComponentFixture, TestBed} from "@angular/core/testing";
import {ApiKeyIndexComponent} from "./apikey-index.component";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {MatAwareDialogModule} from "@spica-client/material";
import {ApiKeyService, MockApiKeyService} from "../../services/apikey.service";
import {RouterTestingModule} from "@angular/router/testing";
import {ApiKey} from "../../interfaces/apikey";
import {By} from "@angular/platform-browser";
import {MatButtonModule} from "@angular/material/button";
import {Input, HostBinding, Directive} from "@angular/core";

@Directive({selector: "[canInteract]"})
export class CanInteractDirectiveTest {
  @HostBinding("style.visibility") _visible = "visible";
  @Input("canInteract") action: string;
  @Input("resource") resource: string;
}

describe("ApiKeyIndexComponent", () => {
  let component: ApiKeyIndexComponent;
  let fixture: ComponentFixture<ApiKeyIndexComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatToolbarModule,
        MatCardModule,
        MatTableModule,
        MatPaginatorModule,
        RouterTestingModule,
        MatButtonModule,
        MatAwareDialogModule,
        HttpClientTestingModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: ApiKeyService,
          useValue: new MockApiKeyService()
        }
      ],
      declarations: [ApiKeyIndexComponent, CanInteractDirectiveTest]
    }).compileComponents();

    fixture = TestBed.createComponent(ApiKeyIndexComponent);
    component = fixture.componentInstance;
    await component["apiKeyService"].insertOne({
      key: "testkey",
      name: "testname",
      active: true,
      description: "testdescription",
      policies: []
    } as ApiKey);

    fixture.detectChanges();
  });

  it("should show apikeys", () => {
    const cells = fixture.debugElement.queryAll(By.css("mat-table mat-cell"));
    expect(cells[0].nativeElement.textContent).toBe("testkey");
    expect(cells[1].nativeElement.textContent).toBe("testname");
    expect(cells[2].nativeElement.textContent).toBe("testdescription");
  });

  it("should delete apikey", async () => {
    component.deleteApiKey("0");

    await fixture.whenStable();
    fixture.detectChanges();

    const cells = fixture.debugElement.queryAll(By.css("mat-table mat-cell"));
    expect(cells).toEqual([]);
  });
});
