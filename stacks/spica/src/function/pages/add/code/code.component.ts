import {Component, OnInit, Inject} from "@angular/core";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: "function-example-code",
  templateUrl: "./code.component.html",
  styleUrls: ["./code.component.scss"]
})
export class CodeComponent implements OnInit {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<CodeComponent>
  ) {}

  ngOnInit(): void {}
}
