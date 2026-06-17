import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastContainer } from './core/notifications/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
