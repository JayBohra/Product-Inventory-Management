package com.sharelist.realtime;

import static com.sharelist.list.TestApi.iceCreamList;
import static com.sharelist.list.TestApi.item;
import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.client.RestTestClient;

import com.sharelist.TestcontainersConfiguration;
import com.sharelist.list.ListController;
import com.sharelist.list.ListSettings;
import com.sharelist.list.TestApi;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@Import(TestcontainersConfiguration.class)
class ListEventsIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private RestTestClient client;

    @Autowired
    private ListEventHub hub;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(client);
    }

    @Test
    void everyoneWatchingGetsTheNewRevisionAfterEachChange() throws Exception {
        var host = api.create(iceCreamList(new ListSettings(true, null, true)));
        String slug = host.list().slug();

        try (HttpClient http = HttpClient.newHttpClient()) {
            BlockingQueue<Event> hostStream = open(http, slug);
            BlockingQueue<Event> guestStream = open(http, slug);

            assertThat(next(hostStream)).isEqualTo(new Event("revision", "{\"revision\":0}"));
            assertThat(next(guestStream)).isEqualTo(new Event("revision", "{\"revision\":0}"));
            assertThat(hub.subscriberCount(slug)).isEqualTo(2);

            var asha = api.join(slug, "Asha");
            assertThat(next(hostStream)).isEqualTo(new Event("revision", "{\"revision\":1}"));
            assertThat(next(guestStream)).isEqualTo(new Event("revision", "{\"revision\":1}"));

            api.claimOk(slug, asha.token(), item(host.list(), "Vanilla").id(), 1);
            assertThat(next(hostStream)).isEqualTo(new Event("revision", "{\"revision\":2}"));
            assertThat(next(guestStream)).isEqualTo(new Event("revision", "{\"revision\":2}"));

            // A rejected change doesn't notify anyone.
            api.claim(slug, asha.token(), item(host.list(), "Vanilla").id(), 5).expectStatus().isEqualTo(409);
            assertThat(hostStream.poll(500, TimeUnit.MILLISECONDS)).isNull();

            client.delete().uri("/api/lists/{slug}", slug).header(ListController.TOKEN_HEADER, host.token())
                    .exchange().expectStatus().isNoContent();
            assertThat(next(hostStream).name()).isEqualTo("deleted");
            assertThat(next(guestStream).name()).isEqualTo("deleted");
        }
    }

    @Test
    void streamsForUnknownListsAreRejected() throws Exception {
        try (HttpClient http = HttpClient.newHttpClient()) {
            HttpResponse<Void> response = http.send(request("zzzzzzzzzz"), HttpResponse.BodyHandlers.discarding());
            assertThat(response.statusCode()).isEqualTo(404);
        }
    }

    private BlockingQueue<Event> open(HttpClient http, String slug) throws Exception {
        HttpResponse<Stream<String>> response = http.send(request(slug), HttpResponse.BodyHandlers.ofLines());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
                type -> assertThat(type).startsWith("text/event-stream"));
        BlockingQueue<Event> events = new LinkedBlockingQueue<>();
        Thread.ofVirtual().start(() -> parse(response.body(), events));
        return events;
    }

    private HttpRequest request(String slug) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/lists/" + slug + "/events"))
                .header("Accept", "text/event-stream")
                .timeout(Duration.ofSeconds(30))
                .build();
    }

    private static Event next(BlockingQueue<Event> events) throws InterruptedException {
        Event event = events.poll(5, TimeUnit.SECONDS);
        assertThat(event).as("expected an event within 5 seconds").isNotNull();
        return event;
    }

    /** Minimal text/event-stream parser: collects "event:" and "data:" lines until a blank line. */
    private static void parse(Stream<String> lines, BlockingQueue<Event> events) {
        String name = "message";
        StringBuilder data = new StringBuilder();
        for (String line : (Iterable<String>) lines::iterator) {
            if (line.isEmpty()) {
                if (!data.isEmpty()) {
                    events.add(new Event(name, data.toString()));
                }
                name = "message";
                data.setLength(0);
            } else if (line.startsWith("event:")) {
                name = line.substring("event:".length()).strip();
            } else if (line.startsWith("data:")) {
                data.append(line.substring("data:".length()).strip());
            }
        }
    }

    private record Event(String name, String data) {
    }
}
