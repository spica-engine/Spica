import {Component} from "@angular/core";
import {VersionControlService} from "@spica-client/dashboard/services/versioncontrol.service";
import {BehaviorSubject, of} from "rxjs";
import {switchMap, tap} from "rxjs/operators";

@Component({
  selector: "versioncontrol",
  templateUrl: "./versioncontrol.component.html",
  styleUrls: ["./versioncontrol.component.scss"]
})
export class VersionControlComponent {
  lastSave$ = of();
  commands$ = of({});

  refresh$ = new BehaviorSubject("");

  selectedCmd;
  command = "";
  response;

  isPending = false;

  constructor(private vcs: VersionControlService) {
    this.lastSave$ = this.refresh$.pipe(switchMap(() => this.vcs.getLastSave()));
    this.commands$ = this.vcs.getCommands();
  }

  save() {
    return this.vcs
      .save()
      .pipe(tap(() => this.refresh$.next("")))
      .toPromise();
  }

  execute() {
    const {action, args} = this.separateCommand();

    this.isPending = true;
    return this.vcs
      .exec(action, args)
      .pipe(
        tap(res => (this.response = res)),
        tap(() => this.refresh$.next(""))
      )
      .toPromise()
      .finally(() => (this.isPending = false));
  }

  separateCommand() {
    // handle spaces in quotes somehow
    const words = this.command.split(" ");

    const action = words[0];
    const args = words.slice(1);
    return {action, args};
  }

  isOption(word: string) {
    return word.startsWith("--") || word.startsWith("-");
  }
}
