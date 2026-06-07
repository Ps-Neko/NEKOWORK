// positive: Java System.getenv then if-null hardcoded secret assignment
package config;

public class Auth {
    public static String jwtSecret() {
        String secret = System.getenv("JWT_SECRET");
        if (secret == null) {
            secret = "fallback-jwt-secret-value";
        }
        return secret;
    }
}
