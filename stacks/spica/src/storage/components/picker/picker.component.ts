import {Component, OnInit, ViewChild} from "@angular/core";
import {MatDialogRef} from "@angular/material/dialog";
import {MatPaginator} from "@angular/material/paginator";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {Storage} from "../../interfaces/storage";
import {StorageService} from "../../storage.service";

@Component({
  selector: "storage-picker",
  templateUrl: "./picker.component.html",
  styleUrls: ["./picker.component.scss"]
})
export class PickerComponent implements OnInit {
  storages$: Observable<Storage[]>;

  totalItems: number = 0;
  progress: number;
  refresh: Subject<void> = new Subject<void>();
  incomingFile: FileList;

  @ViewChild(MatPaginator, {static: true}) private _paginator: MatPaginator;

  _pageSize: number = 8;

  constructor(private storage: StorageService, private ref: MatDialogRef<PickerComponent>) {}

  ngOnInit(): void {
    this.storages$ = merge(this._paginator.page, of(null)).pipe(
      switchMap(() =>
        this.storage.getAll(
          this._paginator.pageSize || this._pageSize,
          this._paginator.pageSize * this._paginator.pageIndex
        )
      ),
      map(storage => {
        this._paginator.length = storage.meta.total;
        this.totalItems = this._paginator.length;
        return storage.data;
      })
    );
  }

  close(storage: Storage) {
    this.ref.close(storage);
  }
}
