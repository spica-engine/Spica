import {ComponentFixture, TestBed} from "@angular/core/testing";
import {
  MatButtonModule,
  MatIconModule,
  MatMenuModule,
  MatTooltip,
  MatTooltipModule
} from "@angular/material";
import {By} from "@angular/platform-browser";
import {Router} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {LayoutModule} from "@spica-client/core/layout";
import {PassportService} from "../../services/passport.service";
import {IdentityBadgeComponent} from "./identity-badge.component";

describe("IdentityBadgeComponent", () => {
  let fixture: ComponentFixture<IdentityBadgeComponent>;
  let passportService: jasmine.SpyObj<Partial<PassportService>> = jasmine.createSpyObj(
    "passportService",
    ["logout"]
  );
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        LayoutModule,
        RouterTestingModule
      ],
      declarations: [IdentityBadgeComponent],
      providers: [
        {
          provide: PassportService,
          useValue: passportService
        }
      ]
    });

    // @ts-ignore
    passportService.decodedToken = {
      _id: "test",
      identifier: "test"
    };

    router = TestBed.get(Router);

    router.navigate = jasmine.createSpy("navigate", router.navigate).and.callThrough();

    fixture = TestBed.createComponent(IdentityBadgeComponent);
    fixture.detectChanges();
  });

  it("should show identifier", () => {
    expect(
      fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip).message
    ).toBe("test");
  });

  it("should logout", () => {
    fixture.componentInstance.unidentify();
    expect(passportService.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(["passport/identify"]);
  });
});
