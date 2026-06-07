// positive: Rust env::var with unwrap_or_else hardcoded secret
use std::env;

pub fn api_key() -> String {
    env::var("API_KEY").unwrap_or_else(|_| String::from("hardcoded-api-key-rust"))
}
