import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';

import {
  DatasetPercentage,
  PredictionRequest,
  PredictionResponse,
  RetrainResponse
} from '../models/housing.models';

declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

interface HealthResponse {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class HousingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = (window.__APP_CONFIG__?.apiBaseUrl ?? '').replace(/\/+$/, '');

  health(): Observable<HealthResponse> {
    return this.request('/health', (url) => this.http.get<HealthResponse>(url));
  }

  predict(payload: PredictionRequest): Observable<PredictionResponse> {
    return this.request('/predict', (url) =>
      this.http.post<PredictionResponse>(url, payload)
    );
  }

  requestRetraining(
    percentage: DatasetPercentage,
    token: string
  ): Observable<RetrainResponse> {
    const headers = new HttpHeaders({ 'X-Retrain-Token': token });
    return this.request('/retrain', (url) =>
      this.http.post<RetrainResponse>(url, { percentage }, { headers })
    );
  }

  private request<T>(path: string, send: (url: string) => Observable<T>): Observable<T> {
    if (!this.baseUrl) {
      return throwError(
        () => new Error('La URL de la API no está configurada para este entorno.')
      );
    }

    return send(`${this.baseUrl}${path}`).pipe(
      timeout({ first: 15_000 }),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new Error('La API tardó demasiado en responder. Comprueba que esté disponible e inténtalo nuevamente.')
            : error
        )
      )
    );
  }
}
