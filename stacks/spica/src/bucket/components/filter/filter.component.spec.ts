import {CommonModule} from "@angular/common";
import {Component, forwardRef, SimpleChange} from "@angular/core";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatInputModule} from "@angular/material/input";
import {MatSelectModule} from "@angular/material/select";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {InputModule} from "@spica-client/common";
import {OwlDateTimeModule, OwlDateTimeInputDirective} from "@danielmoncada/angular-datetime-picker";
import {FilterComponent} from "./filter.component";
import {EditorModule} from "@spica-client/common/code-editor";
import {MatChipsModule} from "@angular/material/chips";
import {MatIconModule} from "@angular/material/icon";
import {MatTooltipModule} from "@angular/material/tooltip";

@Component({
  template: `
    i'm a lonely placer
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => NoopPlacer)
    }
  ]
})
class NoopPlacer implements ControlValueAccessor {
  writeValue = jasmine.createSpy("writeValue");
  _change: Function;
  registerOnChange = jasmine.createSpy("registerOnChange").and.callFake(fn => {
    this._change = fn;
  });
  registerOnTouched = jasmine.createSpy("registerOnTouched");
}

describe("FilterComponent", () => {
  let fixture: ComponentFixture<FilterComponent>;
  const applyButtonSelector = ".filter-buttons > button:first-of-type";
  const clearButtonSelector = ".filter-buttons > button:last-of-type";

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        CommonModule,
        MatSelectModule,
        MatInputModule,
        InputModule.withPlacers([
          {
            color: "#fff",
            icon: "format_qoute",
            origin: "string",
            type: "mytype",
            placer: NoopPlacer
          },
          {
            color: "#fff",
            icon: "format_qoute",
            origin: "string",
            type: "date",
            placer: NoopPlacer
          },
          {
            color: "#fff",
            icon: "format_qoute",
            origin: "string",
            type: "relation",
            placer: NoopPlacer
          }
        ]),
        NoopAnimationsModule,
        OwlDateTimeModule,
        EditorModule,
        MatChipsModule,
        MatIconModule,
        MatTooltipModule
      ],
      declarations: [FilterComponent, NoopPlacer]
    }).compileComponents();

    fixture = TestBed.createComponent(FilterComponent);
    fixture.componentInstance.schema = {
      _id: "objectid",
      primary: undefined,
      properties: {
        test: {
          type: "mytype"
        },
        test1: {
          type: "date"
        },
        test2: {
          type: "relation"
        }
      }
    };
    fixture.componentInstance.ngOnChanges({
      schema: new SimpleChange(undefined, fixture.componentInstance.schema, true)
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(`bucket_objectid_mongodb_filter_history`);
    localStorage.removeItem(`bucket_objectid_expression_filter_history`);
  });

  it("should render properties", () => {
    fixture.debugElement.query(By.css("mat-select")).nativeElement.click();
    fixture.detectChanges();
    const properties = document.body.querySelectorAll(".mat-select-panel > mat-option");
    expect(properties[0].textContent).toBe(" test ");
    expect(properties[1].textContent).toBe(" test1 ");
  });

  it("should render properties with title", () => {
    fixture.componentInstance.schema.properties.test.title = "string title";
    fixture.debugElement.query(By.css("mat-select")).nativeElement.click();
    fixture.detectChanges();
    const property = document.body.querySelector("mat-option");
    expect(property.textContent).toBe(" string title ");
  });

  it("should select the property", () => {
    fixture.debugElement.query(By.css("mat-select")).nativeElement.click();
    fixture.detectChanges();
    const property = document.body.querySelector(".mat-select-panel > mat-option") as HTMLElement;
    property.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.property).toBe("test");
  });

  it("should render the selected property", () => {
    fixture.componentInstance.property = "test";
    fixture.detectChanges();
    const placer = fixture.debugElement.query(By.directive(NoopPlacer));
    expect(placer).toBeTruthy();
  });

  xit("should render date picker when the selected property is a date", () => {
    fixture.componentInstance.property = "test1";
    fixture.detectChanges();
    const directive = fixture.debugElement
      .query(By.directive(OwlDateTimeInputDirective))
      .injector.get(OwlDateTimeInputDirective);
    expect(directive.selectMode).toBe("range");
  });

  describe("apply and clear", () => {
    const changeSpy = jasmine.createSpy("changeSpy");

    beforeEach(() => {
      fixture.componentInstance.filterChange.subscribe(changeSpy);
      fixture.componentInstance.property = "test";
      fixture.detectChanges();
      fixture.debugElement.query(By.directive(NoopPlacer)).componentInstance._change("test1");
    });

    it("should generate the basic filter", () => {
      fixture.componentInstance.property = "test";
      fixture.detectChanges();
      fixture.debugElement.query(By.directive(NoopPlacer)).componentInstance._change("test1");
      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.filter).toEqual({test: "test1"});
    });

    it("should generate the basic filter with operator", () => {
      fixture.componentInstance.property = "test";
      fixture.componentInstance.selectedOperator = "$regex";
      fixture.detectChanges();
      fixture.debugElement.query(By.directive(NoopPlacer)).componentInstance._change("test1");
      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.filter).toEqual({test: {$regex: "test1"}});
    });

    it("should generate the mongodb filter, add it to the history", () => {
      fixture.debugElement
        .query(By.css("div.labels > button:nth-of-type(2)"))
        .nativeElement.click();

      fixture.componentInstance.value = '{"test":"value"}';

      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.filter).toEqual({test: "value"});
      expect(fixture.componentInstance.mongodbHistory).toEqual(['{"test":"value"}']);

      const mongodbHistory = JSON.parse(
        localStorage.getItem(`bucket_objectid_mongodb_filter_history`)
      );
      expect(mongodbHistory).toEqual(['{"test":"value"}']);
    });

    it("should generate the expression filter, add it to the history", () => {
      fixture.debugElement
        .query(By.css("div.labels > button:nth-of-type(3)"))
        .nativeElement.click();

      fixture.componentInstance.value = 'document.title == "test"';

      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.filter).toEqual('document.title == "test"');
      expect(fixture.componentInstance.expressionHistory).toEqual(['document.title == "test"']);

      const expressionFilter = JSON.parse(
        localStorage.getItem(`bucket_objectid_expression_filter_history`)
      );
      expect(expressionFilter).toEqual(['document.title == "test"']);
    });

    it("should keep history length 10", () => {
      const histories = Array.from(new Array(10), (_, index) => (10 - index).toString());

      fixture.componentInstance.addToHistory(histories, "11");
      expect(histories[0]).toEqual("11");
      expect(histories[1]).toEqual("10");

      expect(histories[8]).toEqual("3");
      expect(histories[9]).toEqual("2");
    });

    it("should generate the filter with date", () => {
      const dates = [new Date("2020-04-20T10:00:00.000Z"), new Date("2020-05-20T10:00:00.000Z")];
      fixture.componentInstance.property = "test1";
      fixture.componentInstance.value = dates;
      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.filter).toEqual({
        test1: {$gte: "Date(2020-04-20T10:00:00.000Z)", $lt: "Date(2020-05-20T10:00:00.000Z)"}
      });
    });

    it("should show error of mongodb filter if json.parse fails, and should not write it to the storage", fakeAsync(() => {
      fixture.debugElement
        .query(By.css("div.labels > button:nth-of-type(2)"))
        .nativeElement.click();

      fixture.componentInstance.value = "{";

      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("p.mat-error")).nativeElement.textContent).toEqual(
        "SyntaxError: Unexpected end of JSON input"
      );

      expect(fixture.componentInstance.filter).toEqual(undefined);
      expect(fixture.componentInstance.mongodbHistory).toEqual([]);

      const mongodbHistory = JSON.parse(
        localStorage.getItem(`bucket_objectid_mongodb_filter_history`)
      );
      expect(mongodbHistory).toEqual(null);

      // remove the error from UI after 3 seconds
      tick(3001);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("p.mat-error"))).toEqual(null);
    }), 10000);

    it("should generate the filter for onetoone relation", () => {
      fixture.componentInstance.schema.properties.test2["relationType"] = "onetoone";
      fixture.componentInstance.property = "test2";
      fixture.componentInstance.value = "anobjectid";
      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.filter).toEqual({
        "test2._id": "anobjectid"
      });
    });

    it("should generate the filter for onetomany relation", () => {
      fixture.componentInstance.schema.properties.test2["relationType"] = "onetomany";
      fixture.componentInstance.property = "test2";
      fixture.componentInstance.value = ["anobjectid"];
      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.filter).toEqual({
        "test2._id": {
          $in: ["anobjectid"]
        }
      });
    });

    it("should emit filter", () => {
      fixture.debugElement.query(By.css(applyButtonSelector)).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.filter).toEqual({test: "test1"});
      expect(changeSpy).toHaveBeenCalledWith({test: "test1"});
    });

    it("should clear filter and emit", () => {
      changeSpy.calls.reset();
      fixture.debugElement.query(By.css(clearButtonSelector)).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.filter).toBeUndefined();
      expect(changeSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe("placer", () => {
    beforeEach(() => {
      fixture.componentInstance.property = "test";
      fixture.detectChanges();
    });

    it("should render the selected property", () => {
      const placer = fixture.debugElement.query(By.directive(NoopPlacer));
      expect(placer.nativeElement.textContent).toBe(" i'm a lonely placer ");
    });

    it("should write value to filter", () => {
      const placer = fixture.debugElement.query(By.directive(NoopPlacer));
      placer.componentInstance._change("test1");
      expect(fixture.componentInstance.value).toBe("test1");
    });
  });
});
