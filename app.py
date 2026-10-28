import hmac
import json
import os
from pathlib import Path
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import joblib
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
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

default_origins = "http://localhost:4200,http://127.0.0.1:4200"
allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", default_origins).split(",")
    if origin.strip()
]
if not allowed_origins or "*" in allowed_origins:
    raise RuntimeError("FRONTEND_ORIGINS must contain explicit origins, not '*'.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Retrain-Token"],
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


class RetrainRequest(BaseModel):
    percentage: Literal[25, 50, 100]


class RetrainResponse(BaseModel):
    accepted: bool
    message: str
    image_tag: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict")
def predict(data: InputData) -> OutputData:
    features = pd.DataFrame([data.dict()], columns=HOUSING_FEATURES)
    prediction = model.predict(features)[0]
    return OutputData(prediction=float(prediction))


@app.post("/retrain", response_model=RetrainResponse)
def retrain(
    request: RetrainRequest,
    retrain_token: str | None = Header(default=None, alias="X-Retrain-Token"),
) -> RetrainResponse:
    configured_token = os.getenv("RETRAIN_API_TOKEN")
    if not configured_token or len(configured_token) < 32:
        raise HTTPException(
            status_code=503,
            detail="El servidor requiere una credencial de reentrenamiento de al menos 32 caracteres.",
        )
    if retrain_token is None or not hmac.compare_digest(
        retrain_token.encode("utf-8"), configured_token.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Credencial de administración inválida.")

    dataset_url = os.getenv(f"CLOUDINARY_DATASET_{request.percentage}_URL", "")
    parsed_dataset_url = urlparse(dataset_url)
    if (
        parsed_dataset_url.scheme != "https"
        or parsed_dataset_url.hostname != "res.cloudinary.com"
        or parsed_dataset_url.port not in (None, 443)
        or parsed_dataset_url.username
        or parsed_dataset_url.password
        or not parsed_dataset_url.path.lower().endswith(".csv")
        or parsed_dataset_url.path.split("/")[1:2] != ["doexahadj"]
    ):
        raise HTTPException(
            status_code=503,
            detail=f"La URL Cloudinary del dataset {request.percentage} % no está configurada.",
        )

    github_token = os.getenv("GITHUB_TOKEN")
    if not github_token:
        raise HTTPException(
            status_code=503,
            detail="La integración con GitHub no está configurada en el servidor.",
        )

    repository = os.getenv(
        "GITHUB_REPOSITORY", "SupremeTester2000/deploy_ml_housingCalifornia"
    )
    owner, separator, repo = repository.partition("/")
    if (
        not separator
        or not owner
        or not repo
        or "/" in repo
        or any(character.isspace() for character in repository)
    ):
        raise HTTPException(
            status_code=503,
            detail="GITHUB_REPOSITORY debe tener el formato propietario/repositorio.",
        )

    image_tag = f"california-{request.percentage}"
    dispatch_payload = {
        "event_type": "ml_ci_cd",
        "client_payload": {
            "dataseturl": dataset_url,
            "sha": image_tag,
        },
    }
    github_request = Request(
        f"https://api.github.com/repos/{owner}/{repo}/dispatches",
        data=json.dumps(dispatch_payload).encode("utf-8"),
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {github_token}",
            "Content-Type": "application/json",
            "User-Agent": "california-housing-mlops",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )
    try:
        with urlopen(github_request, timeout=15) as response:
            if response.status != 204:
                raise HTTPException(
                    status_code=502,
                    detail="GitHub no aceptó la solicitud de reentrenamiento.",
                )
    except HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail="GitHub no aceptó la solicitud de reentrenamiento.",
        ) from error
    except (URLError, TimeoutError) as error:
        raise HTTPException(
            status_code=502,
            detail="No fue posible contactar a GitHub para solicitar el reentrenamiento.",
        ) from error

    return RetrainResponse(
        accepted=True,
        message=(
            "Solicitud de reentrenamiento enviada correctamente. "
            "El proceso continuará en GitHub Actions."
        ),
        image_tag=image_tag,
    )