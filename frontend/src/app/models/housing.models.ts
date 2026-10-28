export interface PredictionRequest {
  longitude: number;
  latitude: number;
  housing_median_age: number;
  total_rooms: number;
  total_bedrooms: number;
  population: number;
  households: number;
  median_income: number;
}

export interface PredictionResponse {
  prediction: number;
}

export type DatasetPercentage = 25 | 50 | 100;

export interface RetrainResponse {
  accepted: boolean;
  message: string;
  image_tag: string;
}
