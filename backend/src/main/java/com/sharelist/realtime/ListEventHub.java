package com.sharelist.realtime;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.sharelist.config.AppProperties;
import com.sharelist.list.ListEvents;

/**
 * Keeps the open Server-Sent Event streams per list and pushes a small {@code revision} event to
 * all of them whenever the list changes. Clients react by re-fetching their own view of the list,
 * which keeps per-viewer privacy rules in one place (the REST API).
 *
 * <p>Streams live in memory, so this works for a single application instance. To run several
 * instances behind a load balancer, fan the events out through a shared channel such as
 * PostgreSQL {@code LISTEN/NOTIFY}.
 */
@Component
public class ListEventHub implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(ListEventHub.class);
    static final long RECONNECT_DELAY_MS = 3_000;

    private final Map<String, Set<Subscriber>> subscribers = new ConcurrentHashMap<>();
    private final ExecutorService dispatcher = Executors.newVirtualThreadPerTaskExecutor();
    private final AppProperties.Realtime config;
    private final TaskScheduler scheduler;
    private volatile ScheduledFuture<?> heartbeat;

    ListEventHub(AppProperties properties, TaskScheduler scheduler) {
        this.config = properties.realtime();
        this.scheduler = scheduler;
    }

    /** Opens a stream for a list; empty if the list already has too many open streams. */
    public Optional<SseEmitter> subscribe(String slug, long currentRevision) {
        SseEmitter emitter = new SseEmitter(config.emitterTimeout().toMillis());
        Subscriber subscriber = new Subscriber(emitter);
        boolean[] added = {false};
        subscribers.compute(slug, (key, set) -> {
            Set<Subscriber> target = set != null ? set : ConcurrentHashMap.newKeySet();
            if (target.size() < config.maxSubscribersPerList()) {
                added[0] = target.add(subscriber);
            }
            return target.isEmpty() ? null : target;
        });
        if (!added[0]) {
            return Optional.empty();
        }
        emitter.onCompletion(() -> remove(slug, subscriber));
        emitter.onTimeout(() -> {
            remove(slug, subscriber);
            subscriber.close();
        });
        emitter.onError(error -> remove(slug, subscriber));

        // Tell the client the current revision straight away, so after a reconnect it can tell
        // whether it missed anything while it was offline.
        subscriber.send(SseEmitter.event().name("revision").reconnectTime(RECONNECT_DELAY_MS)
                .data(Map.of("revision", currentRevision)));
        return Optional.of(emitter);
    }

    @TransactionalEventListener
    void onListChanged(ListEvents.Changed event) {
        dispatcher.execute(() -> broadcast(event.slug(),
                () -> SseEmitter.event().name("revision").data(Map.of("revision", event.revision()))));
    }

    @TransactionalEventListener
    void onListDeleted(ListEvents.Deleted event) {
        dispatcher.execute(() -> {
            Set<Subscriber> set = subscribers.remove(event.slug());
            if (set != null) {
                set.forEach(subscriber -> {
                    subscriber.send(SseEmitter.event().name("deleted").data(Map.of()));
                    subscriber.close();
                });
            }
        });
    }

    int subscriberCount(String slug) {
        Set<Subscriber> set = subscribers.get(slug);
        return set == null ? 0 : set.size();
    }

    private void broadcast(String slug, Supplier<SseEmitter.SseEventBuilder> event) {
        Set<Subscriber> set = subscribers.get(slug);
        if (set == null) {
            return;
        }
        for (Subscriber subscriber : set) {
            // Builders can't be reused, so every subscriber gets a fresh one.
            if (!subscriber.send(event.get())) {
                remove(slug, subscriber);
            }
        }
    }

    /** Comment lines keep idle connections open through proxies and reveal dead clients. */
    private void sendHeartbeats() {
        subscribers.forEach((slug, set) -> set.forEach(subscriber -> {
            if (!subscriber.send(SseEmitter.event().comment("ping"))) {
                remove(slug, subscriber);
            }
        }));
    }

    private void remove(String slug, Subscriber subscriber) {
        subscribers.computeIfPresent(slug, (key, set) -> {
            set.remove(subscriber);
            return set.isEmpty() ? null : set;
        });
    }

    // ---------------------------------------------------------------- lifecycle

    @Override
    public void start() {
        heartbeat = scheduler.scheduleAtFixedRate(this::sendHeartbeats, config.heartbeatInterval());
    }

    @Override
    public void stop() {
        if (heartbeat != null) {
            heartbeat.cancel(false);
            heartbeat = null;
        }
        // Completing the streams lets clients reconnect to another instance during a rolling deploy.
        subscribers.values().forEach(set -> set.forEach(Subscriber::close));
        subscribers.clear();
        dispatcher.shutdown();
    }

    @Override
    public boolean isRunning() {
        return heartbeat != null;
    }

    /** One open stream. Sends are serialised because heartbeats and broadcasts run on different threads. */
    private static final class Subscriber {

        private final SseEmitter emitter;
        private final ReentrantLock lock = new ReentrantLock();

        Subscriber(SseEmitter emitter) {
            this.emitter = emitter;
        }

        boolean send(SseEmitter.SseEventBuilder event) {
            lock.lock();
            try {
                emitter.send(event);
                return true;
            } catch (IOException | IllegalStateException e) {
                log.debug("Dropping event stream: {}", e.getMessage());
                return false;
            } finally {
                lock.unlock();
            }
        }

        void close() {
            lock.lock();
            try {
                emitter.complete();
            } catch (RuntimeException ignored) {
                // already completed
            } finally {
                lock.unlock();
            }
        }
    }
}
