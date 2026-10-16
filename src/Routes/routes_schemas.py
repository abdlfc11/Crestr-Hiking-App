from pydantic import BaseModel

class CalculateRouteModel(BaseModel):
    start_point: list[float, float]
    end_point: list[float, float]

class SaveRouteModel(BaseModel):
    route_name: str
    coordinates: list[
        tuple[float, float] | tuple[float, float, float]
    ]

class LoadRouteModel(BaseModel):
    route_name: str

class GetRouteDataModel(BaseModel):
    route_name: str

class AddSharedRouteModel(BaseModel):
    name: str
    coordinates: list[
        tuple[float, float] | tuple[float, float, float]
    ]
    elevation_gain: str
    distance_km: float
    eta_seconds: int
    route_id: str

class DeleteRouteModel(BaseModel):
    route_name: str

class DownloadRouteModel(BaseModel):
    route_name: str
    route_type: str

class NormaliseRouteModel(BaseModel):
    coordinates: list[
        tuple[float, float] | tuple[float, float, float]
    ]