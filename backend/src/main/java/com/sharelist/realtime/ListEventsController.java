package com.sharelist.realtime;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.sharelist.list.ListService;

/** {@code text/event-stream} endpoint that browsers subscribe to with {@code EventSource}. */
@RestController
class ListEventsController {

    private final ListService lists;
    private final ListEventHub hub;

    ListEventsController(ListService lists, ListEventHub hub) {
        this.lists = lists;
        this.hub = hub;
    }

    @GetMapping(path = "/api/lists/{slug}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    ResponseEntity<SseEmitter> events(@PathVariable String slug) {
        // Errors carry no body: EventSource can only see the status code anyway.
        return lists.currentRevision(slug)
                .map(revision -> hub.subscribe(slug, revision)
                        .map(emitter -> ResponseEntity.ok()
                                .cacheControl(CacheControl.noStore())
                                // Stop nginx-style proxies from buffering the stream.
                                .header("X-Accel-Buffering", "no")
                                .body(emitter))
                        .orElseGet(() -> ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
