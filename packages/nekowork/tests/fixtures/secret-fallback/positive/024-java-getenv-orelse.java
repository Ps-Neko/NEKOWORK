// positive: Java System.getenv with Optional.orElse hardcoded secret
package config;

import java.util.Optional;

public class Secrets {
    public static String apiKey() {
        return Optional.ofNullable(System.getenv("API_KEY")).orElse("hardcoded-api-key-fallback");
    }
}
