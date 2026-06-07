# positive: Ruby ENV['X'] || 'fallback' with hardcoded secret
module Auth
  def self.jwt_secret
    ENV["JWT_SECRET"] || "dev-jwt-secret-value"
  end
end
