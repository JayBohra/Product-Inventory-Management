package com.sharelist.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.StandardEnvironment;

/**
 * Lets hosting platforms configure the database with one {@code DATABASE_URL} in the usual
 * {@code postgres://user:password@host:5432/database?options} form, as Render, Neon, Railway and
 * Heroku hand it out. Explicit {@code SPRING_DATASOURCE_*} variables still take precedence.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    static final String VARIABLE = "DATABASE_URL";
    static final String SOURCE_NAME = "databaseUrl";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String value = environment.getProperty(VARIABLE);
        if (value == null || value.isBlank()) {
            return;
        }
        MapPropertySource source = new MapPropertySource(SOURCE_NAME, toDataSourceProperties(value.strip()));
        MutablePropertySources sources = environment.getPropertySources();
        // Below real environment variables and system properties, above application.yaml.
        if (sources.contains(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME)) {
            sources.addAfter(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME, source);
        } else {
            sources.addLast(source);
        }
    }

    static Map<String, Object> toDataSourceProperties(String databaseUrl) {
        URI uri;
        try {
            uri = URI.create(databaseUrl);
        } catch (IllegalArgumentException e) {
            throw invalid();
        }
        String scheme = uri.getScheme();
        if (!"postgres".equals(scheme) && !"postgresql".equals(scheme) || uri.getHost() == null
                || uri.getRawPath() == null || uri.getRawPath().length() <= 1) {
            throw invalid();
        }
        StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://").append(uri.getHost());
        if (uri.getPort() != -1) {
            jdbcUrl.append(':').append(uri.getPort());
        }
        jdbcUrl.append(uri.getRawPath());
        if (uri.getRawQuery() != null) {
            jdbcUrl.append('?').append(uri.getRawQuery());
        }

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("spring.datasource.url", jdbcUrl.toString());
        String userInfo = uri.getRawUserInfo();
        if (userInfo != null) {
            int colon = userInfo.indexOf(':');
            properties.put("spring.datasource.username", decode(colon < 0 ? userInfo : userInfo.substring(0, colon)));
            if (colon >= 0) {
                properties.put("spring.datasource.password", decode(userInfo.substring(colon + 1)));
            }
        }
        return properties;
    }

    /** Percent-decoding without turning '+' into a space (that rule only applies to form data). */
    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }

    private static IllegalStateException invalid() {
        // Never echo the value: it contains the database password.
        return new IllegalStateException(
                VARIABLE + " must look like postgres://user:password@host:5432/database");
    }
}
