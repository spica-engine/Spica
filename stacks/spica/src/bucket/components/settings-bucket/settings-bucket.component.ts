import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, Input, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Bucket, LimitExceedBehaviour } from '@spica-client/bucket/interfaces/bucket';
import { BucketHistoryService } from '@spica-client/bucket/services/bucket-history.service';
import { BucketService } from '@spica-client/bucket/services/bucket.service';
import { InputResolver } from '@spica-client/common';
import { SavingState } from '@spica-client/material';
import { Observable, of } from 'rxjs';
import { catchError, mapTo } from 'rxjs/operators';

@Component({
  selector: 'settings-bucket',
  templateUrl: './settings-bucket.component.html',
  styleUrls: ['./settings-bucket.component.scss']
})
export class SettingsBucketComponent implements OnInit {

  @Input() schema: Bucket;
  isHistoryEndpointEnabled$: Observable<boolean>;
  savingState: SavingState;
  dialogRef: MatDialogRef<any>
  propertyPositionMap: { [k: string]: any[] } = {};


  constructor(
    private historyService: BucketHistoryService,
    private dialog: MatDialog,
    private bs: BucketService,
    public _inputResolver: InputResolver,
  ) { }

  ngOnInit() {
    this.updatePositionProperties();
    this.isHistoryEndpointEnabled$ = this.historyService
      .historyList("000000000000000000000000", "000000000000000000000000")
      .pipe(
        mapTo(true),
        catchError(() => of(false))
      );
    this.savingState = SavingState.Pristine
  }

  onDocumentSettingsChange() {
    if (this.schema.documentSettings) {
      delete this.schema.documentSettings;
    } else {
      this.schema.documentSettings = {
        countLimit: 100,
        limitExceedBehaviour: LimitExceedBehaviour.PREVENT
      };
    }
  }

  openModal(content) {
    this.savingState = SavingState.Pristine
    this.dialogRef = this.dialog.open(content)
  }

  saveBucket() {
    this.savingState = SavingState.Saving
    this.bs.replaceOne(this.schema)
      .toPromise()
      .then(() => { this.savingState = SavingState.Saved; this.dialogRef.close() })
      .catch(() => this.savingState = SavingState.Failed)
  }

  updatePositionProperties() {
    this.propertyPositionMap = Object.entries(this.schema.properties).reduce(
      (accumulator, [key, value]) => {
        value.options.position = value.options.position || "bottom";
        accumulator[value.options.position].push({ key, value });

        return accumulator;
      },
      { left: [], right: [], bottom: [] }
    );
  }
  setPosition(event: CdkDragDrop<any[]>, position?: string) {
    event.previousContainer.data[event.previousIndex].value.options.position = position;
    this.updatePositionProperties();
  }

}
