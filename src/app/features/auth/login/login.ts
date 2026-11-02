import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FormulaireConnexion } from './formulaire-connexion';

/**
 * Page de connexion (route publique). ⚠️ 01/11 — le formulaire, seul point d'entrée de l'authentification, est extrait dans
 * `FormulaireConnexion` : le portail public le porte aussi.
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormulaireConnexion],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {}
