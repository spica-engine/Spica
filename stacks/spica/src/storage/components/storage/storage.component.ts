import {HttpEventType} from "@angular/common/http";
import {Component, forwardRef, HostListener, Inject} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {InputSchema, INPUT_SCHEMA} from "@spica-client/common";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";
import {map} from "rxjs/operators";
import {Observable} from "rxjs";

@Component({
  selector: "storage",
  templateUrl: "./storage.component.html",
  styleUrls: ["./storage.component.scss"],
  viewProviders: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StorageComponent)
    }
  ],
  host: {
    "[class.disabled]": "disabled"
  }
})
export class StorageComponent implements ControlValueAccessor {
  disabled: boolean;

  progress$: Observable<number>;

  isDraggingOver: boolean = false;

  blob: Blob | Storage;
  value: string;

  onChangeFn: (val: string) => void = () => {};
  onTouchedFn: () => void = () => {};

  constructor(
    @Inject(INPUT_SCHEMA) public readonly schema: InputSchema,
    private storage: StorageService
  ) {}

  @HostListener("blur")
  callOnTouched(): void {
    if (this.onTouchedFn) {
      this.onTouchedFn();
    }
  }

  @HostListener("drop", ["$event"])
  uploadStorage(e: DragEvent): void {
    e.preventDefault();
    this.isDraggingOver = false;
    const files = e.dataTransfer.files;

    if (files.length) {
      this.blob = files.item(0);

      this.progress$ = this.storage.insertMany(files).pipe(
        map(event => {
          if (event.type === HttpEventType.UploadProgress) {
            return Math.round((100 * event.loaded) / event.total);
          } else if (event.type === HttpEventType.Response) {
            // TODO: Ideally this should have come from response body
            this.value = event.url + "/" + event.body[0]._id;
            this.onChangeFn(this.value);
            this.progress$ = undefined;
          }
        })
      );
    }
  }

  @HostListener("dragover", ["$event"])
  dragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer.types.indexOf("Files") > -1) {
      e.dataTransfer.dropEffect = "copy";
      this.isDraggingOver = true;
    }
  }

  @HostListener("dragleave", ["$event"])
  dragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDraggingOver = false;
  }

  pickFromStorage(obj: Storage) {
    this.blob = obj;
    this.value = obj.url;
    this.onChangeFn(this.value);
    console.log(this.value);
  }

  writeValue(value: string): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(disabled: boolean) {
    this.disabled = disabled;
  }

  clear() {
    this.progress$ = undefined;
    this.value = this.blob = undefined;
    this.onChangeFn(this.value);
  }
}
