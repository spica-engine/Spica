import {Component, forwardRef, HostListener, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {INPUT_SCHEMA, InternalPropertySchema} from "../../input";

@Component({
  templateUrl: "./boolean.component.html",
  styleUrls: ["./boolean.component.scss"],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => BooleanComponent)}]
})
export class BooleanComponent implements ControlValueAccessor {
  value: boolean;
  disabled: boolean = false;
  _onChangeFn: Function = () => {};

  _onTouchedFn: Function = () => {};

  constructor(@Inject(INPUT_SCHEMA) public schema: InternalPropertySchema) {}

  @HostListener("click")
  callOnTouched(): void {
    this._onTouchedFn();
  }

  writeValue(val: boolean): void {
    this.value = val;
    if (this.value == undefined && this.schema.default != undefined) {
      this.value = !!this.schema.default;
      this._onChangeFn(this.value);
    }
  }

  registerOnChange(fn: any): void {
    this._onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedFn = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
