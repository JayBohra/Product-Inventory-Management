import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';

import {
  canNativeShare,
  canShareFiles,
  copyText,
  inviteText,
  nativeShare,
  personalUrl,
  shareUrl,
  whatsappUrl,
} from '../../core/share';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';
import { QrCode } from '../../shared/qr-code';

/** Ways to invite people: WhatsApp, the native share sheet, a copyable link and a QR code. */
@Component({
  selector: 'app-share-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, QrCode],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.scss',
})
export class ShareDialog {
  private readonly toast = inject(ToastService);

  readonly slug = input.required<string>();
  readonly title = input.required<string>();
  /** This person's own token, for the private "use on another device" link. */
  readonly token = input<string | null>(null);
  readonly isHost = input(false);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly qr = viewChild(QrCode);

  protected readonly url = computed(() => shareUrl(this.slug()));
  protected readonly whatsapp = computed(() => whatsappUrl(inviteText(this.title(), this.url())));
  protected readonly privateUrl = computed(() => {
    const token = this.token();
    return token ? personalUrl(this.slug(), token) : null;
  });
  protected readonly canShare = canNativeShare();

  open(): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  /** Clicks on the backdrop land on the <dialog> element itself. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected async copy(text: string, what: string): Promise<void> {
    if (await copyText(text)) {
      this.toast.success(`${what} copied`);
    } else {
      this.toast.error("Couldn't copy. Press and hold the link to copy it.");
    }
  }

  protected async shareNative(): Promise<void> {
    await nativeShare({
      title: this.title(),
      text: inviteText(this.title(), this.url()),
      url: this.url(),
    });
  }

  protected async downloadQr(): Promise<void> {
    const blob = await this.qr()?.toPngBlob();
    if (!blob) return;
    const file = new File([blob], `${fileName(this.title())}-qr.png`, { type: 'image/png' });
    // On phones, sharing the image straight to WhatsApp is friendlier than a download.
    if (canShareFiles([file])) {
      const shared = await nativeShare({ files: [file], title: this.title(), text: this.url() });
      if (shared) return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
}

function fileName(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'list'
  );
}
