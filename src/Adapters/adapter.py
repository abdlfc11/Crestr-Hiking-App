from abc import ABC, abstractmethod
import os
import math
from typing import List, Tuple, Optional, Dict
import requests
from src.Routes.helpers import ensure_wgs84
from src.config import Config


class BRouterAdapter():
    def __init__(
        self,
        base_url: Optional[str] = None,
        profile_name: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.base_url = (base_url or Config.BROUTER_BASE_URL).rstrip("/")
        self.profile_name = profile_name or Config.BROUTER_PROFILE or "trekking"
        self.timeout = timeout or float(Config.BROUTER_TIMEOUT_SECONDS or 10)

    @staticmethod
    def _extract_coordinates(data: dict) -> List[List[float]]:
        """
        Gets coordinates from a BRouter response in the form [ [x1, y1], [x2, y2], ...]

        """
        if not isinstance(data, dict):
            raise ValueError("BRouter response is not a JSON object")

        if data.get("type") == "FeatureCollection":
            features = data.get("features")
            if not isinstance(features, list) or len(features) != 1:
                raise ValueError("BRouter response does not contain one route feature")
            data = features[0]

        if data.get("type") != "Feature":
            raise ValueError("BRouter response is not a GeoJSON feature")

        geometry = data.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") != "LineString":
            raise ValueError("BRouter response does not contain a LineString")

        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            raise ValueError("BRouter response contains no usable route geometry")

        route_coordinates = []
        for coordinate in coordinates:
            if (
                not isinstance(coordinate, (list, tuple))
                or len(coordinate) < 2
                or len(coordinate) > 3
                or not all(
                    isinstance(value, (int, float))
                    and not isinstance(value, bool)
                    and math.isfinite(value)
                    for value in coordinate
                )
            ):
                raise ValueError("BRouter response contains invalid route coordinates")
            route_coordinates.append([float(value) for value in coordinate])

        return route_coordinates

    def route(
        self,
        start_xy: List[float],
        end_xy: List[float],
        min_slope: float = 0.0
    ) -> Optional[List[List[float]]]:
        """

        Returns the coordinates of a path from

        Parameters:

            - start_xy list[float] : Start in the form [lon, lat]

            - end_xy list[float] : End in the form [lon, lat]

            - min_slope list[float] : End in the form [lon, lat]

        Returns:
            None

        """
        start_lonlat = ensure_wgs84(start_xy)
        end_lonlat = ensure_wgs84(end_xy)

        response = requests.get(
            f"{self.base_url}/brouter",
            params={
                "lonlats": f"{start_lonlat[0]},{start_lonlat[1]}|{end_lonlat[0]},{end_lonlat[1]}",
                "profile": self.profile_name,
                "format": "geojson",
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        return self._extract_coordinates(response.json())
