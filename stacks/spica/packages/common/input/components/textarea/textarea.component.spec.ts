import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {INPUT_SCHEMA} from "../../input";
import {TextAreaComponent} from "./textarea.component";

describe("Common#textarea", () => {
  let fixture: ComponentFixture<TextAreaComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [FormsModule, MatFormFieldModule, MatInputModule, NoopAnimationsModule],
        declarations: [TextAreaComponent],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              type: "textarea",
              $name: "test"
            }
          }
        ]
      })
      .compileComponents();
    fixture = TestBed.createComponent(TextAreaComponent);
    fixture.detectChanges();
  });

  describe("basic behavior", () => {
    it("should create and set the model name", () => {
      const input = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
      expect(input.path).toEqual(["test"]);
    });

    it("should show name as title if title is undefined", () => {
      fixture.componentInstance.schema.title = undefined;
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-label")).nativeElement.textContent).toBe(
        "test"
      );
    });

    it("should show title", () => {
      const title = (fixture.componentInstance.schema.title = "my title");
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-label")).nativeElement.textContent).toBe(title);
    });

    it("should show description if provided", () => {
      expect(fixture.debugElement.query(By.css("mat-hint"))).toBeNull();
      const description = (fixture.componentInstance.schema.description = "my long description");
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("mat-hint")).nativeElement.textContent).toBe(
        description
      );
    });

    it("should default to default value if undefined", fakeAsync(() => {
      const inputElem = fixture.debugElement.query(By.css("textarea")).nativeElement;
      const changeSpy = jasmine.createSpy("ngModelChange");
      fixture.componentInstance.registerOnChange(changeSpy);

      fixture.componentInstance.schema.default = "test";
      fixture.componentInstance.writeValue(undefined);
      fixture.detectChanges();
      tick();
      expect(changeSpy).toHaveBeenCalledWith("test");
      expect(inputElem.value).toBe("test");
    }));

    it("should be valid pristine and untouched", () => {
      const formFieldElem = fixture.debugElement.query(By.css("mat-form-field")).nativeElement;
      expect(formFieldElem.classList).toContain("ng-untouched");
      expect(formFieldElem.classList).toContain("ng-pristine");
      expect(formFieldElem.classList).toContain("ng-valid");
    });

    it("should write value", fakeAsync(() => {
      fixture.componentInstance.writeValue("myvalue");
      fixture.detectChanges();
      tick();
      const inputElem = fixture.debugElement.query(By.css("textarea")).nativeElement;
      expect(inputElem.value).toBe("myvalue");
    }));

    it("should emit input events", fakeAsync(() => {
      const ngModelChange = jasmine.createSpy("ngModelChange");
      fixture.componentInstance.registerOnChange(ngModelChange);
      fixture.detectChanges();
      const inputElem = fixture.debugElement.query(By.css("textarea")).nativeElement;
      inputElem.value = "myvalue";
      inputElem.dispatchEvent(new Event("input"));
      tick(10);
      fixture.detectChanges();
      expect(ngModelChange).toHaveBeenCalledWith("myvalue");
    }));
  });
});
