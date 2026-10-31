import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # go up from /app to project/

env_path = BASE_DIR / ".env"
example_path = BASE_DIR / ".env.example"

dotenv_path = env_path if env_path.exists() else example_path

load_dotenv(dotenv_path)

class Config:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY')
    JWT_SECRET = os.getenv('JWT_SECRET')
    LOCATIONIQ_API_KEY = os.getenv('LOCATIONIQ_API_KEY')
    DATABASE_URI = os.getenv('DATABASE_URI')
    LOCAL_DATABASE_URI = os.getenv('LOCAL_DATABASE_URI')
    BROUTER_BASE_URL = os.getenv('BROUTER_BASE_URL')
    BROUTER_PROFILE = os.getenv('BROUTER_PROFILE')
    BROUTER_TIMEOUT_SECONDS = os.getenv('BROUTER_TIMEOUT_SECONDS')
    UMAMI_WEBSITE_ID = os.getenv('UMAMI_WEBSITE_ID')
    UMAMI_SCRIPT_URL = os.getenv('UMAMI_SCRIPT_URL')
    ENVIRONMENT = os.getenv('ENVIRONMENT')
