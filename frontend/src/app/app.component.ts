import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  DatasetPercentage,
  PredictionRequest,
  RetrainResponse
} from './models/housing.models';
import { HousingApiService } from './services/housing-api.service';

type ApiStatus = 'checking' | 'online' | 'offline';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private readonly api = inject(HousingApiService);

  readonly predictionForm = new FormGroup({
    longitude: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(-180),
      Validators.max(180)
    ]),
    latitude: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(-90),
      Validators.max(90)
    ]),
    housing_median_age: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0)
    ]),
    total_rooms: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0)
    ]),
    total_bedrooms: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0)
    ]),
    population: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0)
    ]),
    households: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0)
    ]),
    median_income: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0)
    ])
  });

  readonly retrainForm = new FormGroup({
    percentage: new FormControl<DatasetPercentage | null>(null, Validators.required),
    operatorToken: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(32)]
    })
  });

  readonly datasetOptions: {
    percentage: DatasetPercentage;
    records: string;
    label: string;
  }[] = [
    { percentage: 25, records: '5.160 registros', label: '25 % del dataset' },
    { percentage: 50, records: '10.320 registros', label: '50 % del dataset' },
    { percentage: 100, records: '20.640 registros', label: '100 % del dataset' }
  ];

  apiStatus: ApiStatus = 'checking';
  isPredicting = false;
  isRetraining = false;
  prediction: number | null = null;
  predictionError = '';
  retrainMessage = '';
  retrainError = false;
  imageTag = '';

  readonly formatCurrency = new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });

  ngOnInit(): void {
    this.checkApi();
  }

  checkApi(): void {
    this.apiStatus = 'checking';
    this.api.health().subscribe({
      next: () => (this.apiStatus = 'online'),
      error: () => (this.apiStatus = 'offline')
    });
  }

  predict(): void {
    if (this.predictionForm.invalid) {
      this.predictionForm.markAllAsTouched();
      return;
    }

    const values = this.predictionForm.getRawValue();
    if (
      values.longitude === null ||
      values.latitude === null ||
      values.housing_median_age === null ||
      values.total_rooms === null ||
      values.total_bedrooms === null ||
      values.population === null ||
      values.households === null ||
      values.median_income === null
    ) {
      return;
    }

    const payload: PredictionRequest = {
      longitude: values.longitude,
      latitude: values.latitude,
      housing_median_age: values.housing_median_age,
      total_rooms: values.total_rooms,
      total_bedrooms: values.total_bedrooms,
      population: values.population,
      households: values.households,
      median_income: values.median_income
    };

    this.prediction = null;
    this.predictionError = '';
    this.isPredicting = true;
    this.api.predict(payload).subscribe({
      next: (response) => {
        this.prediction = response.prediction;
        this.isPredicting = false;
      },
      error: (error: unknown) => {
        this.predictionError = this.getErrorMessage(
          error,
          'No se pudo calcular la predicción. Inténtalo nuevamente.'
        );
        this.isPredicting = false;
      }
    });
  }

  requestRetraining(): void {
    if (this.retrainForm.invalid) {
      this.retrainForm.markAllAsTouched();
      return;
    }

    const { percentage, operatorToken } = this.retrainForm.getRawValue();
    if (percentage === null || !operatorToken) {
      return;
    }

    this.isRetraining = true;
    this.retrainMessage = '';
    this.imageTag = '';
    this.retrainError = false;
    this.retrainForm.controls.operatorToken.setValue('');
    this.api.requestRetraining(percentage, operatorToken).subscribe({
      next: (response: RetrainResponse) => {
        this.retrainMessage = response.message;
        this.imageTag = response.image_tag;
        this.isRetraining = false;
      },
      error: (error: unknown) => {
        this.retrainMessage = this.getErrorMessage(
          error,
          'No se pudo enviar la solicitud. Verifica la conexión y vuelve a intentarlo.'
        );
        this.retrainError = true;
        this.isRetraining = false;
      }
    });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const detail = error.error?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
      if (error.status === 0) {
        return 'No se pudo conectar con la API. Comprueba que esté disponible.';
      }
      return fallback;
    }

    return error instanceof Error ? error.message : fallback;
  }
}
