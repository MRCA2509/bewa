use calamine::{Reader, Xlsx, open_workbook};
fn main() {
    let path = "C:\\Users\\User\\Videos\\contoh file\\派件运单_20260414002350_00568200.xlsx";
    if let Ok(mut workbook) = open_workbook::<Xlsx<_>, _>(path) {
        if let Ok(range) = workbook.worksheet_range_at(0) {
            if let Some(row) = range.rows().next() {
                for (i, cell) in row.iter().enumerate() {
                    println!("Index {}: {}", i, cell);
                }
            }
        }
    }
}
