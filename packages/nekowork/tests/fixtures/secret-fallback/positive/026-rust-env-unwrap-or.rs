// positive: Rust std::env::var with unwrap_or hardcoded secret
pub fn jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or("dev-secret-change-me".to_string())
}
