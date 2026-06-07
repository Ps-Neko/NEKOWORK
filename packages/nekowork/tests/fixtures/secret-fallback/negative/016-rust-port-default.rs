// negative: Rust env::var with non-secret default (port) and fail-closed expect
use std::env;

pub fn port() -> String {
    env::var("PORT").unwrap_or("8080".to_string())
}

pub fn must_secret() -> String {
    env::var("DB_PASSWORD").expect("DB_PASSWORD must be set")
}
