package com.sharelist;

import org.springframework.boot.SpringApplication;

/**
 * Runs the app locally against a PostgreSQL container, so no database setup is needed:
 * {@code ./mvnw spring-boot:test-run} (requires Docker).
 */
public class TestShareListApplication {

    public static void main(String[] args) {
        SpringApplication.from(ShareListApplication::main)
                .with(TestcontainersConfiguration.class)
                .run(args);
    }
}
