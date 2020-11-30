import {ScrollingModule} from "@angular/cdk/scrolling";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {Directive, Input} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatNativeDateModule, MatOptionModule} from "@angular/material/core";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MAT_DIALOG_DATA} from "@angular/material/dialog";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatSliderModule} from "@angular/material/slider";
import {MatToolbarModule} from "@angular/material/toolbar";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {Store} from "@ngrx/store";
import {EditorModule} from "@spica-client/common/code-editor";
import {InputModule} from "@spica-client/common/input";
import {LayoutModule} from "@spica-client/core/layout";
import {MatSaveModule} from "@spica/client/packages/material";
import {of} from "rxjs";
import {AddComponent} from "../../../function/pages/add/add.component";
import {CanInteractDirectiveTest} from "../../../passport/directives/can-interact.directive";
import {examples} from "../../examples/examples";
import {emptyTrigger, FUNCTION_OPTIONS, WEBSOCKET_INTERCEPTOR} from "../../interface";
import {EnqueuerPipe} from "../../pipes/enqueuer";
import {LogViewComponent} from "../log-view/log-view.component";

@Directive({
  selector: "code-editor[language]",
  exportAs: "language"
})
class MockLanguageDirective {
  @Input() marker: any;
  format() {}
}

describe("Function Add", () => {
  let fixture: ComponentFixture<AddComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        HttpClientTestingModule,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatToolbarModule,
        MatFormFieldModule,
        MatListModule,
        MatExpansionModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatCardModule,
        MatSaveModule,
        MatSliderModule,
        LayoutModule,
        InputModule,
        EditorModule,
        NoopAnimationsModule,
        MatOptionModule,
        MatInputModule,
        ScrollingModule,
        MatDatepickerModule,
        MatNativeDateModule
      ],
      providers: [
        {
          provide: Store,
          useValue: {}
        },
        {
          provide: WEBSOCKET_INTERCEPTOR,
          useValue: {}
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of()
          }
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {}
        },
        {
          provide: FUNCTION_OPTIONS,
          useValue: {
            url: ""
          }
        }
      ],
      declarations: [
        AddComponent,
        LogViewComponent,
        EnqueuerPipe,
        MockLanguageDirective,
        CanInteractDirectiveTest
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddComponent);
  });

  it("should set isHandlerDuplicated true", () => {
    fixture.componentInstance.function = {
      name: "test function",
      description: "test description",
      triggers: [emptyTrigger("handler1"), emptyTrigger("handler1")],
      env: [],
      language: "javascript"
    };

    fixture.componentInstance.checkHandlers();
    expect(fixture.componentInstance.isHandlerDuplicated).toEqual(true);
  });

  it("should set isHandlerDuplicated false", () => {
    fixture.componentInstance.function = {
      name: "test function",
      description: "test description",
      triggers: [emptyTrigger("handler1"), emptyTrigger("handler2")],
      env: [],
      language: "javascript"
    };

    fixture.componentInstance.checkHandlers();
    expect(fixture.componentInstance.isHandlerDuplicated).toBe(false);
  });

  it("should delete trigger on the given index, then set isHandlerDuplicated false", () => {
    const func = (fixture.componentInstance.function = {
      name: "test function",
      description: "test description",
      triggers: [emptyTrigger("handler1"), emptyTrigger("handler2"), emptyTrigger("handler1")],
      env: [],
      language: "javascript"
    });

    fixture.componentInstance.deleteTrigger(2);

    expect(func.triggers).toEqual([
      {handler: "handler1", options: {}, type: "http", active: true},
      {
        handler: "handler2",
        options: {},
        type: "http",
        active: true
      }
    ]);

    expect(fixture.componentInstance.isHandlerDuplicated).toBe(false);
  });

  describe("example codes", () => {
    let getExample;
    beforeEach(() => {
      getExample = fixture.componentInstance["functionService"].getExample;
    });

    it("should get system example code ", () => {
      let trigger = {
        type: "system"
      };
      let code = getExample(trigger as any);
      expect(code).toEqual(examples.system);
    });

    it("should return information about unknown trigger", () => {
      let trigger = {
        type: "unknown",
        options: {}
      };
      let code = getExample(trigger as any);
      expect(code).toEqual("Example code does not exist for this trigger.");
    });

    describe("bucket", () => {
      it("should return information about missing inputs", () => {
        let trigger = {
          type: "bucket",
          options: {}
        };
        let code = getExample(trigger as any);
        expect(code).toEqual("Select the phase and operation type to display example code.");
      });

      describe("before", () => {
        it("should get insert example code", () => {
          let trigger = {
            type: "bucket",
            options: {
              phase: "BEFORE",
              type: "INSERT"
            }
          };
          let code = getExample(trigger as any);
          expect(code).toEqual(examples.bucket.BEFORE.INSERT);
        });

        it("should return information about missing inputs", () => {
          let trigger = {
            type: "bucket",
            options: {phase: "BEFORE"}
          };
          let code = getExample(trigger as any);
          expect(code).toEqual("Select the phase and operation type to display example code.");
        });
      });
      describe("after", () => {
        it("should get all example code", () => {
          let trigger = {
            type: "bucket",
            options: {
              phase: "AFTER",
              type: "ALL"
            }
          };
          let code = getExample(trigger as any);
          expect(code).toEqual(examples.bucket.AFTER.ALL);
        });

        it("should return information about missing inputs", () => {
          let trigger = {
            type: "bucket",
            options: {phase: "AFTER"}
          };
          let code = getExample(trigger as any);
          expect(code).toEqual("Select the phase and operation type to display example code.");
        });
      });
    });

    describe("database", () => {
      it("should get delete example code", () => {
        let trigger = {
          type: "database",
          options: {
            type: "DELETE"
          }
        };
        let code = getExample(trigger as any);
        expect(code).toEqual(examples.database.DELETE);
      });

      it("should return information about missing inputs", () => {
        let trigger = {
          type: "database",
          options: {}
        };
        let code = getExample(trigger as any);
        expect(code).toEqual("Select an operation type to display example code.");
      });
    });
  });
});
