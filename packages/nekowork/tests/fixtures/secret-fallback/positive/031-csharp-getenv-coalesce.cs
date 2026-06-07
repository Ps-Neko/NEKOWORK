// positive: C# null-coalescing fallback for a secret env var
public class Config {
  public static string ApiKey =
    Environment.GetEnvironmentVariable("API_KEY") ?? "hardcoded-fallback-key";
}
