// negative: Java env read with non-secret default + fail-closed secret
package config;

public class Settings {
    public static String port() {
        String p = System.getenv("PORT");
        if (p == null) {
            p = "8080";
        }
        return p;
    }

    public static String mustSecret() {
        String s = System.getenv("DB_PASSWORD");
        if (s == null) {
            throw new IllegalStateException("DB_PASSWORD must be set");
        }
        return s;
    }
}
