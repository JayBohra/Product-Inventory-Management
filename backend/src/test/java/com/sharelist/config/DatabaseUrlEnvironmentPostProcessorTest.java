package com.sharelist.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.SystemEnvironmentPropertySource;

class DatabaseUrlEnvironmentPostProcessorTest {

    private final DatabaseUrlEnvironmentPostProcessor processor = new DatabaseUrlEnvironmentPostProcessor();

    private StandardEnvironment environmentWith(Map<String, Object> variables) {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().replace(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                new SystemEnvironmentPropertySource(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                        variables));
        processor.postProcessEnvironment(environment, new SpringApplication());
        return environment;
    }

    @Test
    void turnsAPlatformDatabaseUrlIntoDataSourceSettings() {
        var environment = environmentWith(Map.of(
                "DATABASE_URL", "postgresql://app_user:s3cr%2Ft+pw@dpg-abc123-a:5432/sharelist_db?sslmode=require"));

        assertThat(environment.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://dpg-abc123-a:5432/sharelist_db?sslmode=require");
        assertThat(environment.getProperty("spring.datasource.username")).isEqualTo("app_user");
        assertThat(environment.getProperty("spring.datasource.password")).isEqualTo("s3cr/t+pw");
    }

    @Test
    void acceptsTheShortSchemeAndADefaultPort() {
        var properties = DatabaseUrlEnvironmentPostProcessor.toDataSourceProperties(
                "postgres://neon:pw@ep-cool-name.eu-central-1.aws.neon.tech/neondb");
        assertThat(properties).containsEntry("spring.datasource.url",
                "jdbc:postgresql://ep-cool-name.eu-central-1.aws.neon.tech/neondb");
    }

    @Test
    void explicitSpringVariablesStillWin() {
        Map<String, Object> variables = new HashMap<>();
        variables.put("DATABASE_URL", "postgres://a:b@platform-host:5432/platform");
        variables.put("SPRING_DATASOURCE_URL", "jdbc:postgresql://explicit-host:5432/explicit");
        var environment = environmentWith(variables);

        assertThat(environment.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://explicit-host:5432/explicit");
        assertThat(environment.getProperty("spring.datasource.username")).isEqualTo("a");
    }

    @Test
    void doesNothingWithoutDatabaseUrl() {
        var environment = environmentWith(Map.of());
        assertThat(environment.getPropertySources().contains(DatabaseUrlEnvironmentPostProcessor.SOURCE_NAME))
                .isFalse();
    }

    @Test
    void rejectsMalformedUrlsWithoutLeakingThem() {
        assertThatThrownBy(() -> DatabaseUrlEnvironmentPostProcessor.toDataSourceProperties(
                "mysql://user:topsecret@host/db"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("topsecret");
        assertThatThrownBy(() -> DatabaseUrlEnvironmentPostProcessor.toDataSourceProperties("postgres://host"))
                .isInstanceOf(IllegalStateException.class);
    }
}
