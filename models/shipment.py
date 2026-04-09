"""
Shipment Model - Represents a merged shipment record from Monitor Sampai and Status Terupdate
"""

from datetime import datetime
from typing import Optional, Dict, Any

from config.constants import is_history_rule, get_archive_reason


class Shipment:
    """
    Model untuk shipment yang menggabungkan data dari Monitor Sampai dan Status Terupdate.

    Atribut dari Monitor Sampai (prioritas utama):
        - dp_outgoing, tujuan, jenis_layanan, sumber_order, berat_ditagih
        - drop_point, waktu_sampai, lokasi_sebelumnya, discan_oleh

    Atribut dari Status Terupdate (data pelengkap):
        - no_order, diinput_oleh, waktu_input, penerima, waktu_ttd
        - agent_outgoing, tanggal_pengiriman, agent_tujuan, provinsi_tujuan, kota_tujuan
        - nlc, dp_nlc, biaya_cod, total_dfod, tipe_pembayaran, status_asuransi
        - end_status, keterangan, station_scan, jenis_scan, waktu_scan
        - discan_oleh_scan, sprinter, agent_scan, nomor_bagging
        - alasan_masalah, lokasi_berikutnya
    """

    def __init__(self, data: Dict[str, Any] = None):
        """
        Initialize Shipment from dictionary data.

        Args:
            data: Dictionary containing shipment data from merged Excel files
        """
        data = data or {}

        # Primary Key
        self.waybill_id: Optional[str] = self._clean(
            data.get("No. Waybill") or data.get("waybill_id")
        )

        # === Data Monitor Sampai (Prioritas Utama) ===
        self.dp_outgoing: Optional[str] = self._clean(
            data.get("DP Outgoing") or data.get("dp_outgoing")
        )
        self.tujuan: Optional[str] = self._clean(
            data.get("Tujuan") or data.get("tujuan")
        )
        self.jenis_layanan: Optional[str] = self._clean(
            data.get("Jenis Layanan") or data.get("jenis_layanan")
        )
        self.sumber_order: Optional[str] = self._clean(
            data.get("Sumber Order") or data.get("sumber_order")
        )
        self.berat_ditagih: Optional[float] = self._clean_numeric(
            data.get("Berat Ditagih") or data.get("berat_ditagih")
        )
        self.drop_point: Optional[str] = self._clean(
            data.get("Drop Point") or data.get("drop_point")
        )
        self.waktu_sampai: Optional[datetime] = self._clean_datetime(
            data.get("Waktu Sampai") or data.get("waktu_sampai")
        )
        self.lokasi_sebelumnya: Optional[str] = self._clean(
            data.get("Lokasi Sebelumnya") or data.get("lokasi_sebelumnya")
        )
        self.discan_oleh: Optional[str] = self._clean(
            data.get("Discan oleh") or data.get("discan_oleh")
        )

        # === Data Pelengkap dari Status Terupdate ===
        self.no_order: Optional[str] = self._clean(
            data.get("No Order") or data.get("no_order")
        )
        self.diinput_oleh: Optional[str] = self._clean(
            data.get("Diinput oleh") or data.get("diinput_oleh")
        )
        self.waktu_input: Optional[datetime] = self._clean_datetime(
            data.get("Waktu Input") or data.get("waktu_input")
        )
        self.penerima: Optional[str] = self._clean(
            data.get("Penerima") or data.get("penerima")
        )
        self.waktu_ttd: Optional[datetime] = self._clean_datetime(
            data.get("Waktu TTD") or data.get("waktu_ttd")
        )
        self.waktu_regis_retur: Optional[datetime] = self._clean_datetime(
            data.get("Waktu Regis Retur") or data.get("waktu_regis_retur")
        )
        self.waktu_konfirmasi_retur: Optional[datetime] = self._clean_datetime(
            data.get("Waktu Konfirmasi") or data.get("waktu_konfirmasi_retur")
        )
        self.agent_outgoing: Optional[str] = self._clean(
            data.get("Agent Outgoing") or data.get("agent_outgoing")
        )
        self.tanggal_pengiriman: Optional[datetime] = self._clean_datetime(
            data.get("Tanggal Pengiriman") or data.get("tanggal_pengiriman")
        )
        self.agent_tujuan: Optional[str] = self._clean(
            data.get("Agent Tujuan") or data.get("agent_tujuan")
        )
        self.provinsi_tujuan: Optional[str] = self._clean(
            data.get("Provinsi Tujuan") or data.get("provinsi_tujuan")
        )
        self.kota_tujuan: Optional[str] = self._clean(
            data.get("Kota Tujuan") or data.get("kota_tujuan")
        )
        self.nlc: Optional[str] = self._clean(data.get("NLC") or data.get("nlc"))
        self.dp_nlc: Optional[str] = self._clean(
            data.get("DP NLC") or data.get("dp_nlc")
        )
        self.biaya_cod: Optional[float] = self._clean_numeric(
            data.get("Biaya COD") or data.get("biaya_cod")
        )
        self.total_dfod: Optional[float] = self._clean_numeric(
            data.get("total DFOD") or data.get("total_dfod")
        )
        self.tipe_pembayaran: Optional[str] = self._clean(
            data.get("Tipe Pembayaran") or data.get("tipe_pembayaran")
        )
        self.status_asuransi: Optional[str] = self._clean(
            data.get("Status Asuransi") or data.get("status_asuransi")
        )
        self.end_status: Optional[str] = self._clean(
            data.get("End Status") or data.get("end_status")
        )
        self.keterangan: Optional[str] = self._clean(
            data.get("Keterangan") or data.get("keterangan")
        )

        # Scan Information
        self.station_scan: Optional[str] = self._clean(
            data.get("Station Scan") or data.get("station_scan")
        )
        self.jenis_scan: Optional[str] = self._clean(
            data.get("Jenis Scan") or data.get("jenis_scan")
        )
        self.waktu_scan: Optional[datetime] = self._clean_datetime(
            data.get("Waktu Scan") or data.get("waktu_scan")
        )
        self.discan_oleh_scan: Optional[str] = self._clean(
            data.get("Discan Oleh") or data.get("discan_oleh_scan")
        )
        self.sprinter: Optional[str] = self._clean(
            data.get("Sprinter PU atau Delivery") or data.get("sprinter")
        )
        self.agent_scan: Optional[str] = self._clean(
            data.get("Agent Scan") or data.get("agent_scan")
        )
        self.nomor_bagging: Optional[str] = self._clean(
            data.get("Nomor Bagging") or data.get("nomor_bagging")
        )
        self.alasan_masalah: Optional[str] = self._clean(
            data.get("Alasan Masalah/Tinggal Gudang") or data.get("alasan_masalah")
        )
        self.lokasi_berikutnya: Optional[str] = self._clean(
            data.get("Lokasi Sebelumnya / Berikutnya") or data.get("lokasi_berikutnya")
        )
        self.last_status_sync_at: Optional[datetime] = self._clean_datetime(
            data.get("last_status_sync_at")
        )
        self.feedback: Optional[str] = self._clean(data.get("feedback"))

        # System fields
        self.created_at: Optional[datetime] = self._clean_datetime(
            data.get("created_at")
        )
        self.updated_at: Optional[datetime] = self._clean_datetime(
            data.get("updated_at")
        )

    @staticmethod
    def _clean(value) -> Optional[str]:
        """Clean string value - strip whitespace, handle NaN/None"""
        if value is None:
            return None
        if isinstance(value, float) and str(value) == "nan":
            return None
        return str(value).strip() if value else None

    @staticmethod
    def _clean_numeric(value) -> Optional[float]:
        """Clean numeric value - handle NaN/None"""
        if value is None:
            return None
        try:
            result = float(value)
            if str(result) == "nan":
                return None
            return result
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _clean_datetime(value) -> Optional[datetime]:
        """Clean datetime value - handle various formats"""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            value = value.strip()
            if not value or value.lower() == "nan":
                return None
            # Try common datetime formats
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
                "%d/%m/%Y %H:%M:%S",
                "%d/%m/%Y",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
        return None

    def is_history(self) -> bool:
        """
        Core business logic - menentukan apakah shipment masuk ke tabel histori.

        Menggunakan logika OR - jika SALAH SATU kondisi terpenuhi, maka masuk histori:
        1. jenis_scan IN ('Scan TTD', 'Scan TTD Retur') - pengiriman selesai
        2. station_scan NOT IN ACTIVE_LOCATIONS - keluar dari jaringan aktif
        3. jenis_scan == 'Scan Paket Bermasalah' AND alasan_masalah == 'Hilang Semua'

        Returns:
            True jika data harus masuk ke tabel histori
        """
        return is_history_rule(
            self.jenis_scan or "", self.station_scan or "", self.alasan_masalah or ""
        )

    def get_archive_reason(self) -> str:
        """
        Mendapatkan alasan archiving berdasarkan rule yang terpenuhi.

        Returns:
            String penjelasan alasan archiving
        """
        return get_archive_reason(
            self.jenis_scan or "", self.station_scan or "", self.alasan_masalah or ""
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert shipment to dictionary for database insertion"""
        return {
            "waybill_id": self.waybill_id,
            "dp_outgoing": self.dp_outgoing,
            "tujuan": self.tujuan,
            "jenis_layanan": self.jenis_layanan,
            "sumber_order": self.sumber_order,
            "berat_ditagih": self.berat_ditagih,
            "drop_point": self.drop_point,
            "waktu_sampai": self.waktu_sampai,
            "lokasi_sebelumnya": self.lokasi_sebelumnya,
            "discan_oleh": self.discan_oleh,
            "no_order": self.no_order,
            "diinput_oleh": self.diinput_oleh,
            "waktu_input": self.waktu_input,
            "penerima": self.penerima,
            "waktu_ttd": self.waktu_ttd,
            "waktu_regis_retur": self.waktu_regis_retur,
            "waktu_konfirmasi_retur": self.waktu_konfirmasi_retur,
            "agent_outgoing": self.agent_outgoing,
            "tanggal_pengiriman": self.tanggal_pengiriman,
            "agent_tujuan": self.agent_tujuan,
            "provinsi_tujuan": self.provinsi_tujuan,
            "kota_tujuan": self.kota_tujuan,
            "nlc": self.nlc,
            "dp_nlc": self.dp_nlc,
            "biaya_cod": self.biaya_cod,
            "total_dfod": self.total_dfod,
            "tipe_pembayaran": self.tipe_pembayaran,
            "status_asuransi": self.status_asuransi,
            "end_status": self.end_status,
            "keterangan": self.keterangan,
            "station_scan": self.station_scan,
            "jenis_scan": self.jenis_scan,
            "waktu_scan": self.waktu_scan,
            "discan_oleh_scan": self.discan_oleh_scan,
            "sprinter": self.sprinter,
            "agent_scan": self.agent_scan,
            "nomor_bagging": self.nomor_bagging,
            "alasan_masalah": self.alasan_masalah,
            "lokasi_berikutnya": self.lokasi_berikutnya,
            "last_status_sync_at": self.last_status_sync_at,
            "feedback": self.feedback,
        }

    def __repr__(self) -> str:
        return f"Shipment(waybill_id={self.waybill_id}, tujuan={self.tujuan}, is_history={self.is_history()})"
