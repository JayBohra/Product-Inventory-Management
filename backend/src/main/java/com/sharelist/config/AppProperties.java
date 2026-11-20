package com.sharelist.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @DefaultValue Limits limits,
        @DefaultValue Realtime realtime,
        @DefaultValue Retention retention,
        @DefaultValue Cors cors) {

    public record Limits(
            @DefaultValue("200") int maxItemsPerList,
            @DefaultValue("500") int maxParticipantsPerList) {
    }

    public record Realtime(
            @DefaultValue("15m") Duration emitterTimeout,
            @DefaultValue("20s") Duration heartbeatInterval,
            @DefaultValue("2000") int maxSubscribersPerList) {
    }

    public record Retention(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("180d") Duration deleteInactiveAfter) {
    }

    public record Cors(@DefaultValue List<String> allowedOrigins) {
    }
}
