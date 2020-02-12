import {Directive, HostListener, Input} from "@angular/core";

//TODO: We should refactor copy method when ClipBoard API ready to use for all browsers: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API

@Directive({
  selector: "[matClipboard]",
  exportAs: "matClipboard"
})
export class MatClipboardDirective {
  @Input() icon: string = "info";
  @Input("matClipboard") text: string;

  @HostListener("click")
  copy() {
    if (!this.text) {
      return;
    }

    const element = this.prepareElement(this.text);

    this.copyToClipBoard(element);

    document.body.removeChild(element);

    this.icon = "check";
    setTimeout(() => {
      this.icon = "info";
    }, 1000);
  }

  copyToClipBoard(element: HTMLInputElement) {
    document.body.appendChild(element);
    element.focus();
    element.select();
    document.execCommand("copy");
  }

  prepareElement(text: string): HTMLInputElement {
    const input = document.createElement("input");
    input.value = text;
    return input;
  }
}
