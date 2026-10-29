from pathlib import Path

import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from xgboost import XGBRegressor


# Cargar el dataset
project_dir = Path(__file__).resolve().parent.parent
housing_path = project_dir / "data" / "california_housing.csv"

housing_data = pd.read_csv(housing_path)


# Eliminar filas con valores faltantes
housing_data = housing_data.dropna(axis=0)


# Seleccionar la variable que queremos predecir
y = housing_data.median_house_value


# Seleccionar las características
housing_features = [
    'longitude',
    'latitude',
    'housing_median_age',
    'total_rooms',
    'total_bedrooms',
    'population',
    'households',
    'median_income'
]

X = housing_data[housing_features]


# Dividir los datos en entrenamiento y validación
train_X, val_X, train_y, val_y = train_test_split(
    X,
    y,
    train_size=0.8,
    test_size=0.2,
    random_state=0
)


# Definir el modelo XGBoost
my_model = XGBRegressor(device="cpu")


# Entrenar el modelo
my_model.fit(train_X, train_y)

# Guardar el modelo para que la API pueda cargarlo.
model_path = Path(__file__).resolve().parent / "model.joblib"
joblib.dump(my_model, model_path)


# Realizar predicciones
predictions = my_model.predict(val_X)


# Calcular el Mean Absolute Error
mae = mean_absolute_error(val_y, predictions)

print("XGBoost Mean Absolute Error:", mae)