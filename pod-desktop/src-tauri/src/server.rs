use axum::{
    routing::{get, post},
    Router,
    extract::Path,
    response::IntoResponse,
    http::{StatusCode, header},
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

use crate::api;

use tokio::sync::oneshot;


pub async fn run(tx: oneshot::Sender<u16>) {
    let app = Router::new()
        // Desktop API Routes
        .route("/api/desktop/config", get(api::desktop::config))
        .route("/api/desktop/health", get(api::desktop::health))
        .route("/api/desktop/login", post(api::desktop::login))
        .route("/api/desktop/stats", get(api::desktop::stats))
        .route("/api/desktop/logs", get(api::desktop::system_logs))
        .route("/api/desktop/list-drop-points", post(api::desktop::list_drop_points))
        .route("/api/desktop/outstanding", get(api::desktop::outstanding))
        .route("/api/desktop/sync", post(api::desktop::sync))
        .route("/api/desktop/approve", post(api::desktop::validate))
        .route("/api/desktop/view-image", get(api::desktop::view_image))
        .route("/api/desktop/reject", post(api::desktop::reject))

        .route("/api/desktop/import-excel", post(api::desktop::upload_excel))
        .route("/api/desktop/export-outstanding", get(api::desktop::export_outstanding))
        .route("/api/desktop/export-validated", get(api::desktop::export_validated))
        .route("/api/desktop/export-bundled-validated", get(api::desktop::unified_export_validated))
        .route("/api/desktop/download-zip", get(api::desktop::download_archive))
        .route("/api/desktop/save-image", post(api::desktop::save_image))


        .route("/api/desktop/reset-data", post(api::desktop::reset_data))

        
        // Mobile API Routes
        .route("/api/mobile/login", post(api::mobile::mobile_login))
        .route("/api/mobile/tasks", get(api::mobile::tasks))
        .route("/api/mobile/upload", post(api::mobile::upload_pod))
        
        
        // Serve embedded static web files (Mobile Portal)
        .route("/", get(static_handler))
        .route("/*path", get(static_handler))

        // CORS Middleware
        .layer(CorsLayer::permissive());

    let mut port = 3000;
    let listener = loop {
        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => {
                break l;
            }
            Err(_) => {
                port += 1;
            }
        }
    };

    let _ = tx.send(port);

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("[CRITICAL] Axum server loop failed: {}", e);
    }
}

async fn static_handler(path: Option<Path<String>>) -> impl IntoResponse {
    let path_str = path.map(|Path(p)| p).unwrap_or_else(|| "index.html".to_string());
    
    // Normalize path for index.html
    let asset_path = if path_str.is_empty() || path_str == "/" {
        "index.html"
    } else {
        &path_str
    };

    match crate::assets::Asset::get(asset_path) {
        Some(content) => {
            let mime = mime_guess::from_path(asset_path).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            // Fallback for SPA routing: serve index.html if asset not found
            if let Some(content) = crate::assets::Asset::get("index.html") {
                ([(header::CONTENT_TYPE, "text/html")], content.data).into_response()
            } else {
                (StatusCode::NOT_FOUND, "Not Found").into_response()
            }
        }
    }
}
