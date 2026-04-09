from pydantic_settings import BaseSettings, SettingsConfigDict
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.abspath(os.path.dirname(__file__)), "..", ".env"))

# Add project root to path for imports
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from config.constants import ACTIVE_LOCATIONS


class Settings(BaseSettings):
    # J&T Automation Configuration
    jnt_portal_url: str = "https://jms.jntexpress.id/"
    jnt_batch_size: int = 900
    jnt_user_data_dir: str = os.path.join(
        os.path.abspath(os.path.dirname(__file__)), "..", "data", "browser_profile"
    )
    jnt_user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    jnt_download_dir: str = os.path.join(
        os.path.abspath(os.path.dirname(__file__)), "..", "data", "downloads"
    )

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()

# Use centralized branch list from config.constants (Single Source of Truth)
TARGET_BRANCHES = ACTIVE_LOCATIONS
