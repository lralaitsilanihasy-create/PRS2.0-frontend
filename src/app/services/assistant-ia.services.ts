import { HttpClient, HttpDownloadProgressEvent, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiError, skipErrorToast } from '../core/errors/api-error';
import { EtatAssistantIa, EvenementAssistantIa, SourceAssistantIa } from '../models/assistant-ia.model';

/** Un événement SSE brut : son nom et ses données (lignes `data:` réunies). */
export interface EvenementSse {
  nom: string;
  donnees: string;
}

/**
 * Découpe un tampon SSE en événements complets (séparés par une ligne vide). Le dernier morceau,
 * s'il n'est pas terminé, est rendu dans `reste` pour être complété par la suite du flux.
 */
export function lireEvenementsSse(tampon: string): { evenements: EvenementSse[]; reste: string } {
  const blocs = tampon.split(/\r?\n\r?\n/);
  const reste = blocs.pop() ?? '';
  const evenements: EvenementSse[] = [];
  for (const bloc of blocs) {
    let nom = 'message';
    const donnees: string[] = [];
    for (const ligne of bloc.split(/\r?\n/)) {
      if (ligne.startsWith('event:')) {
        nom = ligne.slice('event:'.length).trim();
      } else if (ligne.startsWith('data:')) {
        donnees.push(ligne.slice('data:'.length).replace(/^ /, ''));
      }
    }
    if (donnees.length) {
      evenements.push({ nom, donnees: donnees.join('\n') });
    }
  }
  return { evenements, reste };
}

/** Traduit un événement SSE du serveur en événement de l'assistant ; `null` s'il est inconnu. */
export function versEvenementAssistant(e: EvenementSse): EvenementAssistantIa | null {
  const donnees = JSON.parse(e.donnees) as unknown;
  switch (e.nom) {
    case 'sources':
      return { type: 'sources', sources: donnees as SourceAssistantIa[] };
    case 'texte':
      return { type: 'texte', texte: (donnees as { t: string }).t };
    case 'fin': {
      const f = donnees as { modele: string; dureeMs: number };
      return { type: 'fin', modele: f.modele, dureeMs: f.dureeMs };
    }
    case 'erreur':
      return { type: 'erreur', message: (donnees as { message: string }).message };
    default:
      return null;
  }
}

/**
 * Assistant IA local — lot 1 (`backend/docs/plan-assistant-ia.md`).
 *
 * La réponse arrive en flux SSE sur un POST : `EventSource` ne sait faire que du GET, on passe donc
 * par `HttpClient` en suivant la progression du téléchargement (`partialText`), ce qui garde le jeton
 * CSRF posé automatiquement. Se désabonner coupe la requête : le serveur cesse alors de calculer.
 *
 * Les erreurs ne passent pas par le toast global (`skipErrorToast`) : le panneau les affiche lui-même,
 * à l'endroit de la réponse attendue.
 */
@Injectable({ providedIn: 'root' })
export class AssistantIaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/assistant-ia`;

  etat(): Observable<EtatAssistantIa> {
    return this.http.get<EtatAssistantIa>(`${this.url}/etat`, { context: skipErrorToast() });
  }

  /**
   * Pose une question. Émet `sources`, puis des `texte` au fil de la génération, puis `fin` — ou
   * `erreur`, y compris quand la requête elle-même échoue (le flux se termine alors normalement).
   */
  poser(question: string): Observable<EvenementAssistantIa> {
    return new Observable<EvenementAssistantIa>((abonne) => {
      let lu = 0;
      let tampon = '';
      const traiter = (texteRecu: string, final: boolean) => {
        tampon += texteRecu.slice(lu);
        lu = texteRecu.length;
        const { evenements, reste } = lireEvenementsSse(final ? tampon + '\n\n' : tampon);
        tampon = final ? '' : reste;
        for (const brut of evenements) {
          const e = versEvenementAssistant(brut);
          if (e) {
            abonne.next(e);
          }
        }
      };
      const requete = this.http
        .post(
          `${this.url}/questions`,
          { question },
          {
            observe: 'events',
            reportProgress: true,
            responseType: 'text',
            headers: { Accept: 'text/event-stream, application/json' },
            context: skipErrorToast(),
          },
        )
        .subscribe({
          next: (ev) => {
            if (ev.type === HttpEventType.DownloadProgress) {
              traiter((ev as HttpDownloadProgressEvent).partialText ?? '', false);
            } else if (ev.type === HttpEventType.Response) {
              traiter(ev.body ?? '', true);
              abonne.complete();
            }
          },
          error: (err: ApiError) => {
            abonne.next({ type: 'erreur', message: messageErreur(err) });
            abonne.complete();
          },
        });
      return () => requete.unsubscribe();
    });
  }
}

function messageErreur(err: ApiError): string {
  if (err.status === 404) {
    return "L'assistant IA n'est pas activé.";
  }
  if (err.status === 0) {
    return 'Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.';
  }
  return err.message || "L'assistant n'a pas pu répondre.";
}
