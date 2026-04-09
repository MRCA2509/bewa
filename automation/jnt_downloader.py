import os
import re
import time
import logging
from datetime import datetime, timedelta
from typing import List, Tuple
from playwright.sync_api import sync_playwright

from automation.config import settings, TARGET_BRANCHES
from automation.jnt_page import JNTPage

logger = logging.getLogger(__name__)


class JNTDownloader:
    """Automates downloading reports from J&T JMS portal."""

    def __init__(self):
        self.config = settings
        self.download_dir = self.config.jnt_download_dir
        self.user_data_dir = self.config.jnt_user_data_dir
        self.target_branches = TARGET_BRANCHES
        self._p = None
        self._context = None

        # Ensure download directory exists
        os.makedirs(self.download_dir, exist_ok=True)

    def _init_browser(self):
        if not self._p:
            self._p = sync_playwright().start()
            self._context = self._p.chromium.launch_persistent_context(
                self.user_data_dir,
                headless=False,
                user_agent=self.config.jnt_user_agent,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-infobars",
                    "--window-position=0,0",
                    "--ignore-certificate-errors",
                ],
            )

    def close(self):
        if self._context:
            try:
                self._context.close()
            except Exception as e:
                logger.debug(f"Error closing browser context: {e}")
            self._context = None
        if self._p:
            try:
                self._p.stop()
            except Exception as e:
                logger.debug(f"Error stopping playwright: {e}")
            self._p = None

    def _chunk_dates(
        self, start_date_str: str, end_date_str: str
    ) -> List[Tuple[datetime, datetime]]:
        """Splits a date range into chunks of maximum 3 consecutive days."""
        start = datetime.strptime(start_date_str, "%Y-%m-%d")
        end = datetime.strptime(end_date_str, "%Y-%m-%d")

        chunks = []
        current = start
        while current <= end:
            chunk_end = min(current + timedelta(days=2), end)
            chunks.append((current, chunk_end))
            current = chunk_end + timedelta(days=1)
        return chunks

    def download_monitor_sampai(
        self, start_date_str: str, end_date_str: str, status_callback=None
    ) -> List[str]:
        """Downloads Monitor Sampai reports for the given date range using proven lico-bot logic."""
        chunks = self._chunk_dates(start_date_str, end_date_str)
        if status_callback:
            status_callback(f"Memproses {len(chunks)} bagian tanggal...")

        downloaded_files = []
        if not self._context:
            self._init_browser()

        try:
            page = (
                self._context.pages[0]
                if self._context.pages
                else self._context.new_page()
            )
            page.set_viewport_size({"width": 1920, "height": 1080})

            jnt_page = JNTPage(page)

            if status_callback:
                status_callback("Mengecek sesi J&T...")
            page.goto("https://jms.jntexpress.id/indexSub", timeout=60000)
            jnt_page.wait_for_manual_login(status_callback=status_callback)

            page.wait_for_selector("text=Operasi", timeout=30000)
            if status_callback:
                status_callback("Navigasi Menu Monitor Sampai...")

            # EXACT LICO-BOT NAVIGATION
            page.get_by_text("Operasi").first.click()
            time.sleep(1)
            page.get_by_text("Monitor", exact=True).first.click()
            time.sleep(1)
            page.get_by_text("Monitor Sampai(Refine)").first.click()

            page.get_by_role("tab", name="Detail", exact=True).wait_for(
                state="visible", timeout=15000
            )
            page.get_by_role("tab", name="Detail", exact=True).click()
            time.sleep(2)

            # Filter: Sudah Sampai - Total (Index 3 usually)
            page.get_by_role("textbox", name="Pilih", exact=True).nth(3).click()
            time.sleep(1)
            page.get_by_text("Sudah Sampai - Total").click()
            time.sleep(1)

            # Filter Area (8 Cabang target) - Index 1 usually
            page.get_by_role("textbox", name="Semua").nth(1).click()
            time.sleep(2)

            # DEBUG: Print all visible list items to see what Playwright sees
            try:
                items = page.locator("li:visible").all_inner_texts()
                logger.info(f"DEBUG > Visible list items: {items}")
            except Exception:
                pass

            os.makedirs("logs", exist_ok=True)
            page.screenshot(path="logs/debug_branches_dropdown.png")

            for branch in self.target_branches:
                try:
                    # In some J&T layouts, it's better to just use get_by_text without exact match
                    # and take the LAST one because the first one might be the search input itself.
                    target = page.get_by_text(branch).last
                    target.scroll_into_view_if_needed()
                    target.click(timeout=5000)
                    time.sleep(0.3)
                except Exception as e:
                    logger.warning(f"Failed to click branch {branch}: {e}")
                    page.screenshot(path=f"logs/error_branch_{branch}.png")
            page.keyboard.press("Escape")
            time.sleep(1)

            for idx, (start_dt, end_dt) in enumerate(chunks):
                if status_callback:
                    status_callback(
                        f"Unduh Monitor Sampai ({idx + 1}/{len(chunks)}): {start_dt.strftime('%d %b')} - {end_dt.strftime('%d %b')}"
                    )

                self._set_date(page, 0, start_dt)
                self._set_date(page, 1, end_dt)

                page.get_by_role("button", name=" Cari").click()

                if status_callback:
                    status_callback("Menunggu data dimuat...")
                try:
                    page.wait_for_selector(
                        ".el-loading-mask", state="hidden", timeout=45000
                    )
                    page.wait_for_selector(
                        ".el-table__body-wrapper, .el-table__empty-block",
                        state="visible",
                        timeout=45000,
                    )
                    time.sleep(1)
                except Exception:
                    logger.debug(
                        "Loading mask timeout, attempting to continue anyway..."
                    )
                    time.sleep(10)

                page.get_by_role("button", name="Export").click()
                time.sleep(3)

                page.get_by_role("button", name="Pusat Unduhan").click()
                time.sleep(5)

                dest = self._wait_for_download(
                    page,
                    f"Monitor_Sampai_{start_dt.strftime('%d%b')}-{end_dt.strftime('%d%b%y')}_{int(time.time())}.xlsx",
                )
                if dest:
                    downloaded_files.append(dest)

                try:
                    page.locator("button.el-dialog__headerbtn:visible").click(
                        timeout=5000
                    )
                except Exception:
                    page.keyboard.press("Escape")
                time.sleep(2)

        except Exception as e:
            if status_callback:
                status_callback(f"[ERROR] {e}")
            logger.error(f"Monitor Sampai automation error: {e}", exc_info=True)

        return downloaded_files

    def _set_date(self, page, input_index: int, target_dt: datetime):
        # EXACT LICO-BOT DATE SETTER
        page.get_by_role("textbox", name="Pilih Tanggal").nth(input_index).click(
            force=True
        )
        time.sleep(1)

        indo_months = {
            1: "Januari",
            2: "Februari",
            3: "Maret",
            4: "April",
            5: "Mei",
            6: "Juni",
            7: "Juli",
            8: "Agustus",
            9: "September",
            10: "Oktober",
            11: "November",
            12: "Desember",
        }
        target_month_indo = indo_months[target_dt.month]
        target_year = target_dt.year
        target_day_str = str(target_dt.day)

        for _ in range(50):
            header_label = page.locator("span.el-date-picker__header-label:visible")
            if header_label.count() < 2:
                time.sleep(1)
                header_label = page.locator("span.el-date-picker__header-label:visible")

            if header_label.count() >= 2:
                year_text = header_label.nth(0).inner_text()
                month_text = header_label.nth(1).inner_text()

                if str(target_year) in year_text and (
                    target_month_indo in month_text
                    or target_dt.strftime("%b") in month_text
                ):
                    break

                match_year = re.search(r"\d{4}", year_text)
                current_year = (
                    int(match_year.group()) if match_year else datetime.now().year
                )

                current_month_num = current_year
                for m_num, m_name in indo_months.items():
                    if m_name in month_text or m_name[:3] in month_text:
                        current_month_num = m_num
                        break

                current_dt = datetime(current_year, current_month_num, 1)
                target_month_start = datetime(target_year, target_dt.month, 1)

                if current_dt > target_month_start:
                    btn = page.locator(
                        "button.el-picker-panel__icon-btn.el-date-picker__prev-btn.el-icon-arrow-left:visible"
                    )
                    if btn.count() > 0:
                        btn.first.click()
                    else:
                        break
                else:
                    btn = page.locator(
                        "button.el-picker-panel__icon-btn.el-date-picker__next-btn.el-icon-arrow-right:visible"
                    )
                    if btn.count() > 0:
                        btn.first.click()
                    else:
                        break
                time.sleep(0.3)
            else:
                break

        # Use exact match for day to avoid picking 11 instead of 1
        page.locator("table.el-date-table:visible").locator(
            "td.available:not(.prev-month):not(.next-month)"
        ).get_by_text(target_day_str, exact=True).first.click()
        time.sleep(1)

    def download_status_terupdate(
        self, awbs: List[str], status_callback=None
    ) -> List[str]:
        """Downloads Status Terupdate reports using proven lico-bot logic."""
        batches = [
            awbs[i : i + self.config.jnt_batch_size]
            for i in range(0, len(awbs), self.config.jnt_batch_size)
        ]
        if status_callback:
            status_callback(f"Memproses {len(batches)} batch AWB...")

        downloaded_files = []
        if not self._context:
            self._init_browser()

        try:
            page = (
                self._context.pages[0]
                if self._context.pages
                else self._context.new_page()
            )
            page.set_viewport_size({"width": 1920, "height": 1080})

            jnt_page = JNTPage(page)

            if status_callback:
                status_callback("Mengecek sesi J&T...")
            page.goto("https://jms.jntexpress.id/indexSub", timeout=60000)
            jnt_page.wait_for_manual_login(status_callback=status_callback)

            page.wait_for_selector("text=Operasi", timeout=30000)
            if status_callback:
                status_callback("Navigasi Menu Status Terupdate...")

            # EXACT LICO-BOT NAVIGATION
            page.get_by_text("Operasi").first.click()
            time.sleep(1)
            page.get_by_text("Pencarian Status Terupdate").first.click()

            page.get_by_role("textbox", name="Maksimum input 1000 waybill").wait_for(
                state="visible", timeout=30000
            )
            time.sleep(1)

            for idx, batch in enumerate(batches):
                if status_callback:
                    status_callback(
                        f"Unduh Status Terupdate ({idx + 1}/{len(batches)}): {len(batch)} AWB"
                    )

                batch_str = " ".join(batch)
                textbox = page.get_by_role(
                    "textbox", name="Maksimum input 1000 waybill"
                )
                textbox.click()
                textbox.focus()

                page.keyboard.press("Control+A")
                page.keyboard.press("Backspace")
                time.sleep(0.5)
                textbox.fill(batch_str)
                time.sleep(2)

                page.get_by_role("button", name=" Cari").click()

                if status_callback:
                    status_callback("Menunggu data dimuat...")
                try:
                    page.wait_for_selector(
                        ".el-loading-mask", state="hidden", timeout=60000
                    )
                    page.wait_for_selector(
                        ".el-table__body-wrapper, .el-table__empty-block",
                        state="visible",
                        timeout=60000,
                    )
                    time.sleep(1)
                except Exception:
                    time.sleep(15)

                page.get_by_role("button", name="Export").click()
                time.sleep(3)

                page.get_by_role("button", name="Pusat Unduhan").click()
                time.sleep(5)

                dest = self._wait_for_download(
                    page, f"Status_Terupdate_Batch_{idx + 1}_{int(time.time())}.xlsx"
                )
                if dest:
                    downloaded_files.append(dest)

                if idx < len(batches) - 1:
                    # Close dialog
                    try:
                        page.locator("button.el-dialog__headerbtn:visible").click(
                            timeout=5000
                        )
                    except Exception:
                        page.keyboard.press("Escape")
                    page.reload()
                    time.sleep(3)

        except Exception as e:
            if status_callback:
                status_callback(f"[ERROR] {e}")
            logger.error(f"Status Terupdate automation error: {e}", exc_info=True)

        return downloaded_files

    def _wait_for_download(self, page, filename: str) -> str:
        MAX_RETRY = 50
        dest = None
        for _ in range(MAX_RETRY):
            try:
                dialog = page.locator("div.el-dialog:visible")
                if dialog.is_visible(timeout=2000):
                    selectors = [
                        dialog.get_by_role("button", name=re.compile(r"Unduh|")),
                        dialog.get_by_title("Unduh"),
                        dialog.get_by_text("Unduh"),
                        dialog.locator("button").filter(
                            has_text=re.compile(r"Unduh|")
                        ),
                        dialog.locator(".el-button--text").first,
                    ]

                    target_btn = None
                    for sel in selectors:
                        if sel.count() > 0 and sel.first.is_visible():
                            target_btn = sel.first
                            if (
                                "Unduh" in target_btn.inner_text()
                                or "" in target_btn.inner_text()
                                or target_btn.get_attribute("title") == "Unduh"
                            ):
                                break
                            target_btn = None

                    if target_btn and not target_btn.is_disabled():
                        with page.expect_download(timeout=60000) as download_info:
                            target_btn.click()

                        download = download_info.value
                        dest = os.path.join(self.download_dir, filename)
                        download.save_as(dest)
                        return dest
            except Exception:
                # Silently retry for expected transient DOM errors during download poll
                pass

            try:
                refresh_btn = (
                    page.locator("div.el-dialog:visible")
                    .locator("button")
                    .filter(has_text="Cari")
                )
                if refresh_btn.is_visible(timeout=1000):
                    refresh_btn.click()
            except Exception:
                pass

            time.sleep(5)

        return dest
