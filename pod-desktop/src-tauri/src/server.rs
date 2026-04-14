use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use crate::api;

pub async fn run() {
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
        .route("/api/desktop/download-zip", get(api::desktop::download_archive))
        .route("/api/desktop/save-image", post(api::desktop::save_image))


        .route("/api/desktop/reset-data", post(api::desktop::reset_data))

        
        // Mobile API Routes
        .route("/api/mobile/login", post(api::mobile::mobile_login))
        .route("/api/mobile/tasks", get(api::mobile::tasks))
        .route("/api/mobile/upload", post(api::mobile::upload_pod))
        
        // Serve static web files
        .nest_service("/", ServeDir::new("./public"))



        
        // CORS Middleware
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Server HTTP Modular Axum Berjalan: http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
