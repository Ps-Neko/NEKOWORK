# positive: Ruby ENV.fetch with hardcoded secret default
module Config
  def self.secret_key_base
    ENV.fetch("SECRET_KEY_BASE", "insecure-default-key-base")
  end
end
