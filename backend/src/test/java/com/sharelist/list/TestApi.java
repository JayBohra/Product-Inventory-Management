package com.sharelist.list;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.client.RestTestClient;

import com.sharelist.list.ListRequests.CreateList;
import com.sharelist.list.ListRequests.ItemInput;
import com.sharelist.list.ListRequests.Name;
import com.sharelist.list.ListRequests.SetClaim;

/** Small typed wrapper around the HTTP API to keep integration tests readable. */
public final class TestApi {

    private final RestTestClient client;

    public TestApi(RestTestClient client) {
        this.client = client;
    }

    /** The example from the brief: an ice cream list where only vanilla is limited (2 scoops). */
    public static CreateList iceCreamList(ListSettings settings) {
        return new CreateList("Ice cream order", "Pick your flavours!", "Jay", settings, List.of(
                new ItemInput("Vanilla", null, 2),
                new ItemInput("Chocolate", "Dark chocolate", null),
                new ItemInput("Strawberry", null, null)));
    }

    public static ListView.Item item(ListView view, String name) {
        return view.items().stream()
                .filter(item -> item.name().equals(name))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No item called " + name));
    }

    public ListView.WithToken create(CreateList request) {
        return client.post().uri("/api/lists").body(request).exchange()
                .expectStatus().isCreated()
                .expectBody(ListView.WithToken.class).returnResult().getResponseBody();
    }

    public ListView view(String slug, String token) {
        return client.get().uri("/api/lists/{slug}", slug)
                .headers(headers -> {
                    if (token != null) {
                        headers.set(ListController.TOKEN_HEADER, token);
                    }
                })
                .exchange()
                .expectStatus().isOk()
                .expectBody(ListView.class).returnResult().getResponseBody();
    }

    public ListView.WithToken join(String slug, String name) {
        return client.post().uri("/api/lists/{slug}/participants", slug).body(new Name(name)).exchange()
                .expectStatus().isCreated()
                .expectBody(ListView.WithToken.class).returnResult().getResponseBody();
    }

    public RestTestClient.ResponseSpec claim(String slug, String token, long itemId, int quantity) {
        return client.put().uri("/api/lists/{slug}/items/{itemId}/claim", slug, itemId)
                .headers(headers -> {
                    if (token != null) {
                        headers.set(ListController.TOKEN_HEADER, token);
                    }
                })
                .body(new SetClaim(quantity))
                .exchange();
    }

    public ListView claimOk(String slug, String token, long itemId, int quantity) {
        return claim(slug, token, itemId, quantity)
                .expectStatus().isOk()
                .expectBody(ListView.class).returnResult().getResponseBody();
    }

    public int claimStatus(String slug, String token, long itemId, int quantity) {
        return claim(slug, token, itemId, quantity).returnResult().getStatus().value();
    }

    public static boolean isConflict(int status) {
        return status == HttpStatus.CONFLICT.value();
    }

    public RestTestClient raw() {
        return client;
    }
}
