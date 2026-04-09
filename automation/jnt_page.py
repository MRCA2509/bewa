import time
import logging
from playwright.sync_api import Page


class JNTPage:
    """
    Page Object for J&T Portal.
    """

    def __init__(self, page: Page):
        self.page = page
        self.logger = logging.getLogger(__name__)

    def is_logged_in(self) -> bool:
        """
        Check if the current session is logged in.
        Returns True if dashboard or operation menu is visible.
        """
        try:
            url = self.page.url
            # If we are on a login page, we are not logged in
            if "/login" in url:
                return False

            # If the URL contains /app/ or /indexSub, we are likely inside the system
            if "/app/" in url or "/indexSub" in url:
                return True

            # Fallback to looking for the "Operasi" menu text
            return self.page.get_by_text("Operasi").first.is_visible(timeout=2000)
        except Exception:
            return False

    def wait_for_manual_login(
        self, timeout_minutes: int = 5, status_callback=None
    ) -> bool:
        """
        Pauses and waits for the user to log in manually.
        Checks every 5 seconds if the login is successful.
        """
        if self.is_logged_in():
            if status_callback:
                status_callback("[OK] Sudah Login. Melanjutkan otomatis...")
            return True

        if status_callback:
            status_callback(
                "[WARN] Menunggu Login Manual... (Buka Jendela Browser Chrome yang Muncul)"
            )

        start_time = time.time()
        while time.time() - start_time < (timeout_minutes * 60):
            if self.is_logged_in():
                if status_callback:
                    status_callback("[OK] Login Berhasil!")
                return True

            elapsed = int(time.time() - start_time)
            remaining = (timeout_minutes * 60) - elapsed
            if elapsed % 30 == 0:
                if status_callback:
                    status_callback(
                        f"[WARN] Menunggu Login Manual... ({remaining} detik tersisa)"
                    )

            time.sleep(5)

        if status_callback:
            status_callback("[X] Waktu tunggu login habis. Silakan coba lagi.")
        raise Exception("Waktu tunggu login manual habis.")
