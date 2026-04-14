use std::fs::File;
use std::io::{Read, Write, Cursor};
use zip::write::FileOptions;

pub fn create_pod_zip(photo_names: Vec<String>) -> Vec<u8> {
    let mut buf = Vec::new();
    {
        let cursor = Cursor::new(&mut buf);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o755);

        let uploads_dir = crate::db::get_local_dir().join("uploads");

        for name in photo_names {
            let path = uploads_dir.join(&name);
            if path.exists() {
                if let Ok(mut f) = File::open(path) {
                    let mut contents = Vec::new();
                    if f.read_to_end(&mut contents).is_ok() {
                        let _ = zip.start_file(name, options);
                        let _ = zip.write_all(&contents);
                    }
                }
            }
        }
        let _ = zip.finish();
    }
    buf
}
