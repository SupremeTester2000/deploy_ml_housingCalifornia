from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


HOUSING_FEATURES = [
    "longitude",
    "latitude",
    "housing_median_age",
    "total_rooms",
    "total_bedrooms",
    "population",
    "households",
    "median_income",
]

app = FastAPI(title="California Housing Value Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).resolve().parent / "model" / "model.joblib"
model = joblib.load(MODEL_PATH)


class InputData(BaseModel):
    longitude: float
    latitude: float
    housing_median_age: float
    total_rooms: float
    total_bedrooms: float
    population: float
    households: float
    median_income: float


class OutputData(BaseModel):
    prediction: float


@app.post("/predict")
def predict(data: InputData) -> OutputData:
    features = pd.DataFrame([data.dict()], columns=HOUSING_FEATURES)
    prediction = model.predict(features)[0]
    return OutputData(prediction=float(prediction))