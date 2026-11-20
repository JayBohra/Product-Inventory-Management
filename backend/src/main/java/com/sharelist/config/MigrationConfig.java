package com.sharelist.config;

import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
class MigrationConfig {

    /**
     * The Docker image starts the app once at build time to record a JVM AOT cache (much faster
     * startup on small machines). No database is reachable then, so that run sets
     * {@code app.aot-training=true} and skips migrations; every real start migrates as usual.
     */
    @Bean
    FlywayMigrationStrategy flywayMigrationStrategy(Environment environment) {
        return flyway -> {
            if (!environment.getProperty("app.aot-training", Boolean.class, false)) {
                flyway.migrate();
            }
        };
    }
}
