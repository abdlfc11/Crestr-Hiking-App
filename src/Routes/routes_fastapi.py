# IMPORTS

# Standard Library Imports
import io
import json
import traceback
import hashlib

# Third-Party Libraries
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
import gpxpy
from fastkml.kml import KML
from fitparse import FitFile
from fastapi import APIRouter, Depends, HTTPException, Request, Response, File, UploadFile
from fastapi.responses import StreamingResponse
from fastapi_limiter.depends import RateLimiter
from pyrate_limiter import Duration, Limiter, Rate

# Local Modules
from src.db import get_session, engine

from src.models import Route, User, RouteSharingTable

from src.constants import DEFAULT_CENTRE

from src.Adapters.adapter import BRouterAdapter

from src.extensions import (
    log_action,
    get_current_user,
    get_user_from_session_id,
    rate_limit_exceeded_callback
)
from src.Routes.routes_schemas import (
    CalculateRouteModel,
    SaveRouteModel,
    LoadRouteModel,
    DeleteRouteModel,
    DownloadRouteModel,
    NormaliseRouteModel,
    GetRouteDataModel,
    AddSharedRouteModel
)

from src.Routes.helpers import (
    check_elevation,
    check_web_mercator,
    generate_geojson,
    generate_gpx,
    normalise_route,
    extract_kml_coords,
    total_haversine_distance,
    calculate_map_centre_and_zoom_wgs84,
    ensure_wgs84
)

router = APIRouter()

# FASTAPI ROUTES

#region Normalised Stats
@router.post(
    '/routing/normalise-route-stats',
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(60, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def calculate_path(
    data: NormaliseRouteModel
):
    try:
        routeStats = normalise_route(data.coordinates)

        return routeStats
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "There was an error normalising route stats. "
            }
        )
#endregion

#region Calculating Path

@router.post(
    '/routing/calculate-path',
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(60, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def calculate_path(
    data: CalculateRouteModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    try:
        start_array = data.start_point
        end_array = data.end_point

        if not isinstance(start_array, list) or not isinstance(end_array, list):
            raise TypeError("Start and end coordinates are required as arrays")
        if len(start_array) < 2 or len(end_array) < 2:
            raise ValueError("Coordinates must be in format [x, y]")

        s_x, s_y = start_array[0], start_array[1]
        e_x, e_y = end_array[0], end_array[1]

        adapter = BRouterAdapter()
        coords = adapter.route([s_x, s_y], [e_x, e_y])  # [[lon, lat] or [lon, lat, elev], ...]

        if not coords:
            raise HTTPException(
                status_code=500,
                detail={
                    "success": False,
                    "message": "No path could be created",
                    "user_message": "Sorry, path could not be generated, please try again later.",
                },
            )

        # This calculates elev gain
        elevation_gain = 0
        for c1, c2 in zip(coords, coords[1:]):
            elev1 = c1[2] if len(c1) >= 3 else None
            elev2 = c2[2] if len(c2) >= 3 else None
            if elev1 is not None and elev2 is not None:
                elevation_gain += max(0, elev2 - elev1)

        start_elevation = int(coords[0][2]) if len(coords[0]) >= 3 and coords[0][2] is not None else 0
        end_elevation = int(coords[-1][2]) if len(coords[-1]) >= 3 and coords[-1][2] is not None else 0
        elevation_change = end_elevation - start_elevation

        # This calculates distance + eta
        total_distance = total_haversine_distance(coords)   # metres
        total_distance_km = total_distance / 1000
        eta_seconds = normalise_route(coords)["eta_seconds"]

        path_geojson = {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"color": "#2563eb"},
        }

        # Map centre – these helpers also expect Web Mercator today
        map_centre, map_zoom = calculate_map_centre_and_zoom_wgs84(coords)

        route_stats = {
            "start_elevation": start_elevation,
            "end_elevation": end_elevation,
            "elevation_change": elevation_change,
            "elevation_gain": elevation_gain,
            "total_distance": round(total_distance_km, 2),
            "eta_seconds": eta_seconds,
        }

        log_action("Calculating Path", True, f"distance: {round(total_distance_km, 2)}km", None, "PATH_CREATED")

        return {
            "success": True,
            "pathGeoJSON": path_geojson,
            "map_centre": map_centre,
            "map_zoom": map_zoom,
            "route_stats": route_stats,
            "coordinates": coords,
            "startCoord": coords[0],
            "endCoord": coords[-1],
        }

    except HTTPException:
        raise
    except Exception as e:
        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
        log_action("Calculating Path", False, short_traceback, None, "INVALID_COORDS_AUTO_PATH_CREATION")
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Routing : HTTP 500 Error",
                "user_message": "Sorry, there was an unexpected error whilst creating your route, please try again later.",
            },
        )

#endregion

#region Saving Route

@router.post(
    '/routing/save-route',
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def save_route(
    data: SaveRouteModel,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user)
):
    try:

        if not user:

            raise HTTPException(
                status_code=401,
                detail={
                    "success": False,
                    "message": "Unauthenticated attempt to save a route.",
                    "user_message": "Please log in to save routes. "
                }
            )

        route_name = data.route_name
        coordinates = data.coordinates # these are in Lon, Lat format

        if not route_name or not route_name.strip():

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "A route name is required. ",
                    "user_message": "A route name is required, please try again."
                }
            )


        if not coordinates or len(coordinates) < 2:

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Invalid route data",
                    "user_message": "The route data is invalid. Please try again."
                }
            )

        metrics = normalise_route(coordinates)

        route = Route(
            name=route_name,
            coordinates=json.dumps(coordinates),
            user_id=user.id,

            distance_km=metrics["distance_km"],
            eta_seconds=metrics["eta_seconds"],
            elevation_change=metrics["elevation_gain_m"]
        )

        route_info = {
            "route_name": route_name,
            "distance_km": metrics["distance_km"],
            "eta_seconds": metrics["eta_seconds"],
            "elevation_gain_metres": metrics["elevation_gain_m"],
        }


        db.add(route)
        db.commit()

        log_action('Saving Route', True, None, None, 'SAVE_ROUTE')

        return {
            "success": True,
            "route_info": route_info
        }


    except IntegrityError as e:
        db.rollback()

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Saving Route', False, short_traceback, None, 'SAVE_ROUTE')

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "ERROR : route name cannot be the same as other routes.",
                "user_message": "A route with this name already exists. Please pick a new name."
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Saving Route', False, short_traceback, None, 'SAVE_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "There was an error saving your route. "
            }
        )

#endregion

#region Loading Route

@router.post(
    "/routing/load-route",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def load_route(
    data: LoadRouteModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):

    if not user:

        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthenticated attempt to load a route.",
                "user_message": "Please Login to load routes."
            }
        )

    route_name = data.route_name

    if not route_name:

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Route name is required.",
                "user_message": "A route name is required, please try again."
            }
        )


    route = db.exec(
        select(Route)
        .where(Route.name == route_name, Route.user_id==user.id)
    ).first()

    if not route:

        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "message": "The route could not be found in the server. ",
                "user_message": "Sorry, the route could not be found in the server."
            }
        )

    json_coords = json.loads(route.coordinates)

    coordinates = json_coords

    has_elevation = check_elevation(coordinates)

    try:
        wgs84_coordinates = []

        # routes saved prior to switch to Lat/Lon projection for storing routes will have coordinates stored in Web Mercator projection
        # this checks these coordinates and converts them to Lon/Lat if Web Mercator coordinates are found
        if check_web_mercator(coordinates[0]):
            for coord in coordinates:
                x, y = coord[0], coord[1]
                z = coord[2] if len(coord) >= 3 else 0   # default elevation = 0
                lon, lat = ensure_wgs84([x, y])
                wgs84_coordinates.append([lon, lat, z])
        else:
            # already lat/lon: normalise lengths
            for coord in coordinates:
                x, y = coord[0], coord[1]
                z = coord[2] if len(coord) >= 3 else 0
                wgs84_coordinates.append([x, y, z])

        if not wgs84_coordinates:

            log_action('Loading Route', False, "No coordinates found in the route", None, 'LOAD_ROUTE')

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "There are no valid coordinates within the route file. ",
                    "user_message": "Sorry, the coordinates in the file are not valid. "
                }
            )

        # converts coordinates to geojson format for display
        path_geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": wgs84_coordinates},
                "properties": {"color": "#2563eb"}
            }]
        }


        # calculates midpoint for map centring
        midpoint = wgs84_coordinates[len(wgs84_coordinates)//2] if wgs84_coordinates else DEFAULT_CENTRE

        # data collected directly from database values
        eta_seconds = route.eta_seconds
        distance = route.distance_km
        elevation_change = route.elevation_change

        # route statistics to pass to frontend
        route_stats = {
            "total_distance": distance if distance is not None else 0,
            "eta_seconds": eta_seconds,
            "elevation_change": elevation_change
        }

        log_action('Loading Route', True, None, None, 'LOAD_ROUTE')

        return {
            "success": True,
            "message": f"Route '{route_name}' loaded successfully",
            "pathGeoJSON": path_geojson,
            "map_centre": midpoint,
            "coordinates": wgs84_coordinates,
            "route_stats": route_stats
        }

    except HTTPException:
        raise

    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Loading Route', False, short_traceback, None, 'LOAD_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error whilst loading your route. "
            }
        )

#endregion

#region Get Route Data


@router.post(
    "/routing/get-route-data",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def get_route_data(
    data: GetRouteDataModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):

    if not user:

        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthenticated attempt to load a route.",
                "user_message": "Please Login to share a route."
            }
        )

    route_name = data.route_name

    if not route_name:

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Route name is required.",
                "user_message": "A route name is required, please try again."
            }
        )


    route = db.exec(
        select(Route)
        .where(Route.name == route_name, Route.user_id==user.id)
    ).first()

    if not route:

        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "message": "The route could not be found in the server. ",
                "user_message": "Sorry, the route could not be found in the server."
            }
        )

    coordinates = json.loads(route.coordinates)
    eta_seconds = route.eta_seconds
    distance = route.distance_km
    elevation_change = route.elevation_change

    has_elevation = check_elevation(coordinates)

    try:
        wgs84_coordinates = []

        if check_web_mercator(coordinates[0]):
            # in web mercator -> must convert to wgs84
            for coord in coordinates:
                x, y = coord[0], coord[1]
                z = coord[2] if len(coord) >= 3 else 0   # default elevation = 0
                lon, lat = ensure_wgs84([x, y])
                wgs84_coordinates.append([lon, lat, z])
        else:
            # already wgs84
            for coord in coordinates:
                x, y = coord[0], coord[1]
                z = coord[2] if len(coord) >= 3 else 0
                wgs84_coordinates.append([x, y, z])

        if not wgs84_coordinates:

            log_action('Getting Route Data', False, "No coordinates found in the route saved on the server", None, 'GET_ROUTE_DATA')

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "There are no valid coordinates within the route saved on the server's database. ",
                }
            )

        return {
            "success": True,
            "coordinates": wgs84_coordinates,
            "distance_km": distance,
            "eta_seconds": eta_seconds,
            "elevation_gain": elevation_change,
            "name": route_name
        }

        return
    except HTTPException:
        raise
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Loading Route', False, short_traceback, None, 'GET_ROUTE_DATA')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error whilst loading your route. "
            }
        )


#endregion

#region Get Shared Route
@router.get(
    "/routing/route/{route_id}",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def get_shared_route(
    route_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    if not route_id:
        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "A shared route ID is required.",
                "user_message": "The shared route link is missing its route ID."
            }
        )

    try:
        route = db.exec(
            select(RouteSharingTable)
            .where(RouteSharingTable.route_id==route_id)
        ).first()

        if not route:
            raise HTTPException(
                status_code=404,
                detail={
                    "success": False,
                    "message": "The route was not found",
                    "user_message": "The route was not found in the server, please try again later"
                }
            )

        coordinates = json.loads(route.coordinates)
        if not coordinates:
            log_action('Loading Shared Route', False, "No coordinates found in the shared route", None, 'GET_SHARED_ROUTE')

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "There are no valid coordinates within the shared route.",
                    "user_message": "Sorry, this shared route does not contain valid coordinates."
                }
            )

        wgs84_coordinates = []

        # Shared routes may contain coordinates saved in either Web Mercator or WGS84.
        if check_web_mercator(coordinates[0]):
            for coord in coordinates:
                x, y = coord[0], coord[1]
                z = coord[2] if len(coord) >= 3 else 0
                lon, lat = ensure_wgs84([x, y])
                wgs84_coordinates.append([lon, lat, z])
        else:
            for coord in coordinates:
                x, y = coord[0], coord[1]
                z = coord[2] if len(coord) >= 3 else 0
                wgs84_coordinates.append([x, y, z])

        path_geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": wgs84_coordinates
                },
                "properties": {"color": "#2563eb"}
            }]
        }

        midpoint = wgs84_coordinates[len(wgs84_coordinates) // 2]

        route_stats = {
            "total_distance": route.distance_km if route.distance_km is not None else 0,
            "eta_seconds": route.eta_seconds,
            "elevation_change": route.elevation_gain
        }

        return {
            "success": True,
            "message": f"Route '{route.name}' loaded successfully",
            "pathGeoJSON": path_geojson,
            "map_centre": midpoint,
            "coordinates": wgs84_coordinates,
            "route_stats": route_stats
        }

    except HTTPException:
        raise
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Loading Route', False, short_traceback, None, 'GET_SHARED_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error whilst getting this route. "
            }
        )

#endregion

#region Adding Shared Route

@router.post(
    "/routing/add-shared-route",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def add_shared_route(
    data: AddSharedRouteModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    if not user:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthenticated attempt to share a route",
                "user_message": "Please login to share a route"
            }
        )

    try:

        eta_seconds = data.eta_seconds
        distance_km = data.distance_km
        elevation_gain = data.elevation_gain
        coordinates = data.coordinates
        route_id = data.route_id
        name = data.name

        if not coordinates:
            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Empty coordinates given",
                    "user_message": "Sorry, the route you tried to share was invalid."
                }
            )

        normalised_coords = [
            [
                round(float(coord[0]), 5),
                round(float(coord[1]), 5),
                float(coord[2]) if len(coord) >= 3 else 0,
            ]
            for coord in coordinates
        ]
        hash_coords = [
            [coord[0], coord[1]]
            for coord in normalised_coords
        ]
        route_json = json.dumps(hash_coords, separators=(',', ':'))
        route_hash = hashlib.sha256(route_json.encode('utf-8')).hexdigest()

        existing_route = db.exec(
            select(RouteSharingTable)
            .where(
                RouteSharingTable.user_id == user.id,
                RouteSharingTable.route_hash == route_hash,
            )
        ).first()
        if existing_route:
            return {
                "success": True,
                "code": existing_route.route_id,
            }

        SharedRoute = RouteSharingTable(
            name=name,
            route_id=route_id,
            user_id=user.id,
            coordinates=json.dumps(normalised_coords),
            distance_km=distance_km,
            eta_seconds=eta_seconds,
            elevation_gain=elevation_gain,
            route_hash=route_hash
        )

        db.add(SharedRoute)
        db.commit() #

        return {
            "success": True,
            "code": route_id
        }

    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        existing_route = db.exec(
            select(RouteSharingTable)
            .where(
                RouteSharingTable.user_id == user.id,
                RouteSharingTable.route_hash == route_hash,
            )
        ).first()
        if existing_route:
            return {
                "success": True,
                "code": existing_route.route_id,
            }
        raise HTTPException(
            status_code=409,
            detail={
                "success": False,
                "message": "The route could not be shared because its ID is already in use.",
                "user_message": "Sorry, this route could not be shared. Please try again."
            }
        )
    except Exception as e:
        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Sharing Route', False, short_traceback, None, 'ADD_SHARED_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Error whilst sharing route",
                "user_message": "Sorry, there was an unexpected error whilst sharing your route. "
            }
        )

#endregion

#region Load Shared Route

#endregion

#region Delete Route

@router.post(
    "/routing/delete-route",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def delete_route(
    data: DeleteRouteModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    route_name = data.route_name

    if not user:

        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthenticated attmept to delete route",
                "user_message": "Please log in to delete routes."
            }
        )


    if not route_name:

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Route name is required.",
                "user_message": "A route name is required, please try again."
            }
        )

    try:

        route = db.exec(
            select(Route)
            .where(Route.name == route_name, Route.user_id == user.id)
        ).first()

        if not route:

            raise HTTPException(
                status_code=404,
                detail={
                    "success": False,
                    "message": "Route to be deleted could not be found",
                    "user_message": "Could not find the route you want to delete."
                }
            )
        deleted_route_name = route.name
        db.delete(route)
        db.commit()

        return {
            "success": True,
            "message": f"Successfully deleted the route : {deleted_route_name}"
        }

    except HTTPException:
        raise
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Deleting Route', False, short_traceback, None, 'DELETE_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error whilst trying to delete your route. "
            }
        )

#endregion

#region Import Route

@router.post(
    "/routing/import-route-file",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
async def import_route(
    route_file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    """
    This function handles route file uploads for GPX, FIT, KML, and GeoJSON formats.

    it received as parameters:
        - route file

    it returns:
        JSON containing:
            success (bool)
            coords (list of [lat, lon, ele?])
    """

    MAX_FILE_MB = 5

    if not user:

        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Please Login to import files. "
            }
        )

    if not route_file:

        log_action('Importing Route', False, 'Uploaded file could not be retrieved', None, 'IMPORT_ROUTE')

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Cannot receive uploaded file",
                "user_message": "We could not receive the uploaded file, please try again later."
            }
        )

    if route_file.size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Imported route is too large. ",
                "user_message": "Imported route is too large, please pick a route under 5MB in size. "
            }
        )

    try:

        # this extracts the filename and file extension
        filename = route_file.filename or ""
        ext = filename.rsplit('.', 1)[-1].lower() if "." in filename else ""

        # this validates the supported formats
        if ext not in ["gpx", "fit", "kml", "geojson"]:

            raise HTTPException(
                status_code=400,
                detail={
                    "success": False,
                    "message": "ERROR : Unsupported file type",
                    "user_message": "Please upload a file of the supported types. "
                }
            )

        # this reads raw bytes asynchronously (works for both binary + text formats) for FIT file type
        raw = await route_file.read()

        # this decodes text formats (GPX, KML, GeoJSON)
        text = raw.decode("utf-8", errors="ignore")

        # this handles GPX file types
        if ext == "gpx":
            # Parse GPX XML
            gpx = gpxpy.parse(text)

            converted_points = []

            # Extract all track points into [lat, lon, ele]
            points = [
                [p.latitude, p.longitude, p.elevation]
                for t in gpx.tracks
                for s in t.segments
                for p in s.points
            ]

            for point in points:

                lat, lon = point[0], point[1]
                ele = point[2] if point[2] is not None else 0

                converted_points.append([lon, lat, ele])

            log_action('Importing Route', True, ext, None, 'IMPORT_ROUTE')

            return {
                "success": True,
                "coords": converted_points,
            }

        # this handles FIT file types
        elif ext == "fit":
            coords = []
            converted_coords = []
            fitfile = FitFile(raw)

            for record in fitfile.get_messages("record"):
                lat = record.get_value("position_lat")
                lon = record.get_value("position_long")

                # Skip missing coordinate records
                if lat is None or lon is None:
                    continue

                # FIT stores coordinates in semicircles → convert to degrees
                lat_deg = lat * (180 / 2**31)
                lon_deg = lon * (180 / 2**31)

                coords.append([lat_deg, lon_deg])

            for coord in coords:

                lat, lon = coord[0], coord[1]

                converted_coords.append([lon, lat])

            log_action('Importing Route', True, ext, None, 'IMPORT_ROUTE')

            return {
                "success": True,
                "coords": converted_coords
            }

        # this handles KML file types
        elif ext == "kml":

            # moves file pointer back to the first byte to allow the entire file to be read
            await route_file.seek(0)

            doc = KML.parse(route_file.file, strict=False)
            kml_coords = extract_kml_coords(doc)

            # extract_kml_coords returns [lat, lon, ele] (KML native)
            # this normalises to the app's [lon, lat, ele] format.
            coords = [
                [c[1], c[0], c[2]] if len(c) >= 3 else [c[1], c[0], 0]
                for c in kml_coords
            ]

            # logging is commented out as KML imports are not fully supported --> prevents false positives
            # log_action('Importing Route', True, ext, None, 'IMPORT_ROUTE')

            return {
                "success": True,
                "coords": coords
            }

        # this handles geojson file types
        elif ext == "geojson":
            geo = json.loads(text)
            coords = []
            geometries = []

            """

            structure of geojson files is usually like the below:

            {{
                "type": "FeatureCollection",
                    "features": [
                        {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[-1.8, 53.3, 250], [-1.8, 53.4, 260]]
                        },
                        "properties": {}
                        }
                    ]
                }
            """

            # this extracts the object allowing us to use conditional logic to work towards the coords of the file
            root_type = geo.get("type")

            if root_type == "FeatureCollection":
                for feature in geo.get("features", []):
                    if "geometry" in feature:
                        geometries.append(feature["geometry"])
            elif root_type == "Feature":
                if "geometry" in geo:
                    geometries.append(geo["geometry"])
            else:
                # this is if the root is geometry itself

                # validate that the geom type is actually a geometry
                if geo.get('type') in ["Point", "LineString", "MultiLineString", "Polygon"]:
                    geometries.append(geo)
                else:
                    log_action('Importing Route', False, 'Invalid GeoJSON Structure', None, "IMPORT_ROUTE")

                    raise HTTPException(
                        status_code=500,
                        detail={
                            "success": False,
                            "message": "There was an error on our end, please try again later."
                        }
                    )

            # this is for processing LineString geometries
            for geom in geometries:
                if geom and geom.get("type") == "LineString":
                    for coord in geom.get("coordinates", []):
                        # this unpacks the values from each coord

                        if len(coord) <= 1:
                            return {
                                "success": False,
                                "message": "Error whilst parsing GeoJSON: given coordinates have one value only"
                            }

                        lon = coord[0]
                        lat = coord[1]
                        ele = coord[2] if len(coord) > 2 else 0

                        coords.append([lon, lat, ele])

            log_action('Importing Route', True, ext, None, 'IMPORT_ROUTE')

            return {
                "success": True,
                "coords": coords
            }

    except HTTPException:
        raise
    except Exception as e:

            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

            log_action('Importing Route', False, short_traceback, None, 'IMPORT_ROUTE')

            raise HTTPException(
                        status_code=500,
                        detail={
                            "success": False,
                            "message": "There was an error on our end, please try again later."
                        }
                    )

#endregion

#region Downloading Route

@router.post(
    "/routing/download-route",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def download_route_file(
    data: DownloadRouteModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):

    if not user:

        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthenticated attempt to download a route"
            }
        )

    route_name = data.route_name
    file_type = data.route_type

    # ensures that routes have a name (defensive programming since it is almost impossible a route doesn't have a name due to design of app)
    if not route_name or not file_type:

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Route name and file type is required. ",
                "user_message": "Both the route name and route file type are required, please try again."
            }
        )

    # ensures that routes have a file type
    # also impossible that this is the case since download occurs through either a gpx or a geojson button and not path / query params
    # as path / query params may be implemented in the future, it is kept + it is a good habit
    if file_type not in ["gpx", "geojson"]:

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Invalid file type. Use 'gpx' or 'geojson' format. ",
                "user_message": "Invalid file type. Download routes as 'gpx' or 'geojson'."
            }
        )


    route = db.exec(
        select(Route)
        .where(Route.name == route_name, Route.user_id == user.id)
    ).first()

    # ensures that a route is found before attempting to convert
    if not route:

        log_action('Downloading Route', False, 'Route not found', None, 'DOWNLOAD_ROUTE')

        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "message": "Route not found or you don't own it",
                "user_message": "Could not download the route. Check that it exists and belongs to you."
            }
        )


    try:
        if file_type == "gpx":
            content = generate_gpx(route)
            mimetype = 'application/gpx+xml'
            extension = 'gpx'
        else:
            content = generate_geojson(route)
            mimetype = 'application/geo+json'
            extension = 'geojson'

        safe_name = "".join(
            char if char.isalnum() or char in " -_()" else "_"
            for char in route.name
        )



        file_io = io.BytesIO(content.encode('utf-8'))

        log_action('Downloading Route', True, extension, None, 'DOWNLOAD_ROUTE')

        return StreamingResponse(
            file_io,
            media_type=mimetype,
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.{extension}"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Downloading Route', False, short_traceback, None, 'DOWNLOAD_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error, try again later. "
            }
        )


#endregion
