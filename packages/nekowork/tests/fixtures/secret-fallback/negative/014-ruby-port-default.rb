# negative: Ruby ENV with non-secret fallback (port / host)
module Config
  def self.port
    ENV.fetch("PORT", "3000")
  end

  def self.host
    ENV["HOST"] || "localhost"
  end
end
