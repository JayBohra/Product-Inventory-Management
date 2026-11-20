package com.sharelist.list;

import java.time.Clock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.sharelist.config.AppProperties;

/** Deletes lists nobody has touched for a long time (configurable via {@code app.retention}). */
@Component
class ListRetentionJob {

    private static final Logger log = LoggerFactory.getLogger(ListRetentionJob.class);

    private final SharedListRepository lists;
    private final Clock clock;
    private final AppProperties.Retention retention;

    ListRetentionJob(SharedListRepository lists, Clock clock, AppProperties properties) {
        this.lists = lists;
        this.clock = clock;
        this.retention = properties.retention();
    }

    @Scheduled(cron = "0 17 3 * * *")
    @Transactional
    public void deleteInactiveLists() {
        if (!retention.enabled()) {
            return;
        }
        int deleted = lists.deleteInactiveSince(clock.instant().minus(retention.deleteInactiveAfter()));
        if (deleted > 0) {
            log.info("Deleted {} lists inactive for more than {}", deleted, retention.deleteInactiveAfter());
        }
    }
}
