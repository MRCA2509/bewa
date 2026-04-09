"""
Business Constants and Rules for Shipment History Separation

Core Logic: Data dipindahkan ke tabel histori jika memenuhi SALAH SATU kondisi (OR):
1. jenis_scan IN ('Scan TTD', 'Scan TTD Retur') - Pengiriman selesai
2. station_scan NOT IN ACTIVE_LOCATIONS - Keluar dari jaringan aktif

Data TETAP AKTIF jika:
- Jenis scan masih dalam proses (Scan Kirim, Pack, dll)
- Station scan masih di lokasi aktif
"""

# Lokasi Aktif - shipment masih diproses di lokasi ini
ACTIVE_LOCATIONS = [
    "MABA",
    "BULI",
    "WASILE",
    "SOFIFI",
    "LABUHA",
    "FALAJAWA2",
    "SANANA",
    "BOBONG",
]

# Scan types yang menandakan pengiriman selesai (TTD = Tanda Terima Dokumen)
TTD_SCAN_TYPES = ["Scan TTD", "Scan TTD Retur"]

# Scan types yang menandakan masih dalam proses (tetap aktif)
ACTIVE_SCAN_TYPES = [
    "Scan Pickup",
    "Scan Kirim",
    "Scan Kirim Mobil",
    "Pack",
    "Scan Paket Bermasalah",
]


def is_history_rule(
    jenis_scan: str, station_scan: str, alasan_masalah: str = ""
) -> bool:
    """
    Core business logic untuk menentukan apakah shipment masuk ke tabel histori.

    Menggunakan logika OR - jika SALAH SATU kondisi terpenuhi, maka masuk histori:
    1. Scan TTD atau Scan TTD Retur (pengiriman selesai)
    2. Station scan bukan lokasi aktif (keluar dari jaringan)
    3. Paket dinyatakan hilang permanen (Jenis Scan: Scan Paket Bermasalah, Alasan: Hilang Semua)

    Args:
        jenis_scan: Jenis scan dari data Status Terupdate
        station_scan: Station scan dari data Status Terupdate
        alasan_masalah: Alasan masalah jika terjadi paket bermasalah

    Returns:
        True jika data harus masuk ke tabel histori, False jika tetap di tabel aktif
    """
    # Rule 1: Scan TTD atau Scan TTD Retur = pengiriman selesai
    if jenis_scan in TTD_SCAN_TYPES:
        return True

    # Rule 3: Scan Paket Bermasalah dan Alasan Masalah = 'Hilang Semua' OR 'VOID PENGOPERASIAN'
    if jenis_scan == "Scan Paket Bermasalah" or jenis_scan == "Scan Bermasalah":
        if type(alasan_masalah) is str and alasan_masalah.strip() in [
            "Hilang Semua",
            "VOID PENGOPERASIAN",
            "VOID : SALAH PENGOPERASIAN",
        ]:
            return True

    # Rule 2: Station scan bukan lokasi aktif = keluar dari jaringan
    # Normalize station_scan (e.g., "MABA | MAB01" -> "MABA")
    clean_station = station_scan.split("|")[0].strip().upper() if station_scan else ""

    # If station_scan is empty/NULL, keep in active (Miss PU / Salah Tembak)
    if not clean_station:
        return False

    if clean_station not in ACTIVE_LOCATIONS:
        return True

    # Default: Tetap aktif (masih dalam proses di lokasi aktif)
    return False


def get_archive_reason(
    jenis_scan: str, station_scan: str, alasan_masalah: str = ""
) -> str:
    """
    Mendapatkan alasan archiving berdasarkan rule yang terpenuhi.

    Args:
        jenis_scan: Jenis scan dari data Status Terupdate
        station_scan: Station scan dari data Status Terupdate
        alasan_masalah: Alasan masalah opsional

    Returns:
        String penjelasan alasan archiving
    """
    reasons = []

    if jenis_scan in TTD_SCAN_TYPES:
        reasons.append(f"Jenis scan '{jenis_scan}' menandakan pengiriman selesai")

    if (
        (jenis_scan == "Scan Paket Bermasalah" or jenis_scan == "Scan Bermasalah")
        and type(alasan_masalah) is str
        and alasan_masalah.strip()
        in ["Hilang Semua", "VOID PENGOPERASIAN", "VOID : SALAH PENGOPERASIAN"]
    ):
        reasons.append(f"Paket bermasalah: {alasan_masalah}")

    clean_station = station_scan.split("|")[0].strip().upper() if station_scan else ""
    if clean_station and clean_station not in ACTIVE_LOCATIONS:
        reasons.append(f"Station '{clean_station}' bukan lokasi aktif")

    return " | ".join(reasons) if reasons else "Tidak memenuhi kriteria histori"
