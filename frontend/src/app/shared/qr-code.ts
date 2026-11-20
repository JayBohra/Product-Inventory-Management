import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { encode } from 'uqr';

/** Renders a scannable QR code as crisp SVG, and can export it as a PNG. */
@Component({
  selector: 'app-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="viewBox()"
      role="img"
      [attr.aria-label]="label()"
      shape-rendering="crispEdges"
    >
      <rect [attr.width]="qr().size" [attr.height]="qr().size" fill="#fff" />
      <path [attr.d]="path()" fill="#111" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 12px;
    }
  `,
})
export class QrCode {
  readonly value = input.required<string>();
  readonly label = input('QR code');

  protected readonly qr = computed(() => encode(this.value(), { ecc: 'M', border: 2 }));
  protected readonly viewBox = computed(() => `0 0 ${this.qr().size} ${this.qr().size}`);

  /** One rectangle per horizontal run of dark modules keeps the path short. */
  protected readonly path = computed(() => {
    const { data, size } = this.qr();
    let d = '';
    for (let y = 0; y < size; y++) {
      let x = 0;
      while (x < size) {
        if (!data[y][x]) {
          x++;
          continue;
        }
        const start = x;
        while (x < size && data[y][x]) {
          x++;
        }
        d += `M${start} ${y}h${x - start}v1h-${x - start}z`;
      }
    }
    return d;
  });

  /** Draws the code on a canvas, e.g. to download it or share it as an image. */
  toPngBlob(pixelsPerModule = 12): Promise<Blob> {
    const { data, size } = this.qr();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * pixelsPerModule;
    const context = canvas.getContext('2d');
    if (!context) {
      return Promise.reject(new Error('Canvas is not supported'));
    }
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[y][x]) {
          context.fillRect(x * pixelsPerModule, y * pixelsPerModule, pixelsPerModule, pixelsPerModule);
        }
      }
    }
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png'),
    );
  }
}
