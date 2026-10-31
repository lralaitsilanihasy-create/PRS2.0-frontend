import { Component, DestroyRef, DOCUMENT, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { activerTableauxEnFiches } from './core/affichage/tableaux-en-fiches';
import { ToastContainer } from './core/notifications/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor() {
    // ⚠️ 31/10 (pilote, Espace de travail, lot 2) — les tableaux simples passent en fiches sous 768 px (core/affichage).
    const doc = inject(DOCUMENT);
    const destruction = inject(DestroyRef);
    afterNextRender(() => {
      const arreter = activerTableauxEnFiches(doc);
      destruction.onDestroy(arreter);
    });
  }
}
