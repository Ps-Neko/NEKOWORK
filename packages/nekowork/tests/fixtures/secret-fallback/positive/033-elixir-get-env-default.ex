# positive: Elixir System.get_env/2 default for a secret env var
defmodule Config do
  def auth_token do
    System.get_env("AUTH_TOKEN", "fallback-token-value")
  end
end
