import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { ToastOutlet } from './shared/toast-outlet';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, ToastOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
