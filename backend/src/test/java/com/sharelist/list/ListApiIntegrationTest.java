package com.sharelist.list;

import static com.sharelist.list.TestApi.iceCreamList;
import static com.sharelist.list.TestApi.item;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

import com.sharelist.TestcontainersConfiguration;
import com.sharelist.list.ListRequests.CreateList;
import com.sharelist.list.ListRequests.ItemInput;
import com.sharelist.list.ListRequests.Name;
import com.sharelist.list.ListRequests.ReorderItems;
import com.sharelist.list.ListRequests.UpdateList;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@Import(TestcontainersConfiguration.class)
class ListApiIntegrationTest {

    private static final ListSettings OPEN = new ListSettings(true, null, true);

    @Autowired
    private RestTestClient client;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(client);
    }

    @Test
    void limitedItemCountsDownForEveryoneAndIsDisabledAtZero() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        assertThat(host.token()).isNotBlank();
        assertThat(host.list().me().host()).isTrue();
        assertThat(host.list().hostName()).isEqualTo("Jay");

        ListView.Item vanilla = item(host.list(), "Vanilla");
        assertThat(vanilla.quantityLimit()).isEqualTo(2);
        assertThat(vanilla.available()).isEqualTo(2);

        var asha = api.join(slug, "Asha");
        var ravi = api.join(slug, "Ravi");

        ListView afterAsha = api.claimOk(slug, asha.token(), vanilla.id(), 1);
        assertThat(item(afterAsha, "Vanilla").available()).isEqualTo(1);
        assertThat(item(afterAsha, "Vanilla").myQuantity()).isEqualTo(1);
        assertThat(afterAsha.me().total()).isEqualTo(1);

        // Everyone else now sees only one vanilla left.
        ListView raviSees = api.view(slug, ravi.token());
        assertThat(item(raviSees, "Vanilla").available()).isEqualTo(1);
        assertThat(item(raviSees, "Vanilla").myQuantity()).isZero();

        api.claim(slug, ravi.token(), vanilla.id(), 2)
                .expectStatus().isEqualTo(409)
                .expectBody()
                .jsonPath("$.code").isEqualTo("NOT_ENOUGH_LEFT")
                .jsonPath("$.available").isEqualTo(1)
                .jsonPath("$.detail").isEqualTo("Only 1 of \"Vanilla\" left.");

        ListView soldOut = api.claimOk(slug, ravi.token(), vanilla.id(), 1);
        assertThat(item(soldOut, "Vanilla").available()).isZero();

        api.claim(slug, asha.token(), vanilla.id(), 2)
                .expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.detail").isEqualTo("Sorry, \"Vanilla\" is all taken.");

        // The host sees who took what, in the order people joined.
        ListView hostSees = api.view(slug, host.token());
        assertThat(item(hostSees, "Vanilla").claims())
                .extracting(ListView.ItemClaim::name, ListView.ItemClaim::quantity)
                .containsExactly(tuple("Asha", 1), tuple("Ravi", 1));
        assertThat(hostSees.participants())
                .extracting(ListView.Person::name, ListView.Person::total)
                .containsExactly(tuple("Jay", 0), tuple("Asha", 1), tuple("Ravi", 1));
        assertThat(hostSees.claimedTotal()).isEqualTo(2);

        // Giving one back makes it available again.
        ListView afterReturn = api.claimOk(slug, asha.token(), vanilla.id(), 0);
        assertThat(item(afterReturn, "Vanilla").available()).isEqualTo(1);
        assertThat(item(afterReturn, "Vanilla").claims()).extracting(ListView.ItemClaim::name).containsExactly("Ravi");
    }

    @Test
    void unlimitedItemsCanBeTakenFreely() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        ListView.Item chocolate = item(host.list(), "Chocolate");
        assertThat(chocolate.quantityLimit()).isNull();
        assertThat(chocolate.available()).isNull();
        assertThat(chocolate.note()).isEqualTo("Dark chocolate");

        var asha = api.join(slug, "Asha");
        ListView view = api.claimOk(slug, asha.token(), chocolate.id(), 7);
        assertThat(item(view, "Chocolate").claimed()).isEqualTo(7);
        assertThat(item(view, "Chocolate").available()).isNull();
        assertThat(view.me().remaining()).isNull();
    }

    @Test
    void perPersonLimitAppliesAcrossTheWholeList() {
        var host = api.create(iceCreamList(new ListSettings(true, 2, true)));
        String slug = host.list().slug();
        var asha = api.join(slug, "Asha");

        api.claimOk(slug, asha.token(), item(host.list(), "Chocolate").id(), 1);
        ListView view = api.claimOk(slug, asha.token(), item(host.list(), "Vanilla").id(), 1);
        assertThat(view.me().total()).isEqualTo(2);
        assertThat(view.me().remaining()).isZero();

        api.claim(slug, asha.token(), item(host.list(), "Strawberry").id(), 1)
                .expectStatus().isEqualTo(409)
                .expectBody()
                .jsonPath("$.code").isEqualTo("PERSON_LIMIT_REACHED")
                .jsonPath("$.remaining").isEqualTo(0)
                .jsonPath("$.limit").isEqualTo(2);
    }

    @Test
    void maxOnePerPersonMeansExactlyOnePick() {
        var host = api.create(iceCreamList(new ListSettings(false, 1, true)));
        String slug = host.list().slug();
        var asha = api.join(slug, "Asha");
        long chocolate = item(host.list(), "Chocolate").id();

        api.claim(slug, asha.token(), chocolate, 2).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("ONE_PER_ITEM");
        api.claimOk(slug, asha.token(), chocolate, 1);
        api.claim(slug, asha.token(), item(host.list(), "Strawberry").id(), 1).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("PERSON_LIMIT_REACHED");
    }

    @Test
    void privateListsHideWhoTookWhatFromGuestsButNotFromTheHost() {
        var host = api.create(iceCreamList(new ListSettings(true, null, false)));
        String slug = host.list().slug();
        var asha = api.join(slug, "Asha");
        var ravi = api.join(slug, "Ravi");
        long vanilla = item(host.list(), "Vanilla").id();
        api.claimOk(slug, asha.token(), vanilla, 1);

        ListView raviSees = api.view(slug, ravi.token());
        assertThat(item(raviSees, "Vanilla").claims()).isNull();
        assertThat(item(raviSees, "Vanilla").available()).isEqualTo(1);
        assertThat(raviSees.participants()).isNull();
        assertThat(raviSees.participantCount()).isEqualTo(3);

        ListView ashaSees = api.view(slug, asha.token());
        assertThat(item(ashaSees, "Vanilla").myQuantity()).isEqualTo(1);

        ListView hostSees = api.view(slug, host.token());
        assertThat(item(hostSees, "Vanilla").claims()).extracting(ListView.ItemClaim::name).containsExactly("Asha");
        assertThat(hostSees.participants()).hasSize(3);
    }

    @Test
    void visitorsCanLookBeforeJoiningButNotPick() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        long vanilla = item(host.list(), "Vanilla").id();

        ListView anonymous = api.view(slug, null);
        assertThat(anonymous.me()).isNull();
        assertThat(anonymous.items()).hasSize(3);

        api.claim(slug, null, vanilla, 1).expectStatus().isUnauthorized()
                .expectBody().jsonPath("$.code").isEqualTo("NOT_JOINED");
        api.claim(slug, "not-a-real-token", vanilla, 1).expectStatus().isUnauthorized();

        // A token from another list doesn't work here.
        var other = api.create(iceCreamList(OPEN));
        api.claim(slug, other.token(), vanilla, 1).expectStatus().isUnauthorized();
        assertThat(api.view(slug, other.token()).me()).isNull();
    }

    @Test
    void onlyTheHostCanManageTheList() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        var asha = api.join(slug, "Asha");
        var update = new UpdateList("Hacked", null, OPEN, false);

        client.put().uri("/api/lists/{slug}", slug).header(ListController.TOKEN_HEADER, asha.token())
                .body(update).exchange()
                .expectStatus().isForbidden()
                .expectBody().jsonPath("$.code").isEqualTo("HOST_ONLY");
        client.post().uri("/api/lists/{slug}/items", slug).header(ListController.TOKEN_HEADER, asha.token())
                .body(new ItemInput("Mango", null, null)).exchange()
                .expectStatus().isForbidden();
        client.delete().uri("/api/lists/{slug}", slug).header(ListController.TOKEN_HEADER, asha.token())
                .exchange()
                .expectStatus().isForbidden();
        client.put().uri("/api/lists/{slug}", slug).body(update).exchange().expectStatus().isUnauthorized();

        assertThat(api.view(slug, null).title()).isEqualTo("Ice cream order");
    }

    @Test
    void hostEditsItemsAndSettings() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        String hostToken = host.token();
        var asha = api.join(slug, "Asha");
        long vanilla = item(host.list(), "Vanilla").id();
        api.claimOk(slug, asha.token(), vanilla, 2);

        ListView added = client.post().uri("/api/lists/{slug}/items", slug)
                .header(ListController.TOKEN_HEADER, hostToken)
                .body(new ItemInput("  Mango   sorbet ", "  vegan  ", 5)).exchange()
                .expectStatus().isCreated()
                .expectBody(ListView.class).returnResult().getResponseBody();
        ListView.Item mango = item(added, "Mango sorbet");
        assertThat(mango.note()).isEqualTo("vegan");
        assertThat(added.items()).extracting(ListView.Item::name).last().isEqualTo("Mango sorbet");

        client.post().uri("/api/lists/{slug}/items", slug).header(ListController.TOKEN_HEADER, hostToken)
                .body(new ItemInput("vanilla", null, null)).exchange()
                .expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("ITEM_NAME_TAKEN");

        client.put().uri("/api/lists/{slug}/items/{id}", slug, vanilla).header(ListController.TOKEN_HEADER, hostToken)
                .body(new ItemInput("Vanilla", null, 1)).exchange()
                .expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("LIMIT_BELOW_CLAIMED").jsonPath("$.claimed").isEqualTo(2);

        ListView raised = client.put().uri("/api/lists/{slug}/items/{id}", slug, vanilla)
                .header(ListController.TOKEN_HEADER, hostToken)
                .body(new ItemInput("Vanilla bean", null, 4)).exchange()
                .expectStatus().isOk()
                .expectBody(ListView.class).returnResult().getResponseBody();
        assertThat(item(raised, "Vanilla bean").available()).isEqualTo(2);

        List<Long> reversed = raised.items().stream().map(ListView.Item::id).toList().reversed();
        ListView reordered = client.put().uri("/api/lists/{slug}/item-order", slug)
                .header(ListController.TOKEN_HEADER, hostToken)
                .body(new ReorderItems(reversed)).exchange()
                .expectStatus().isOk()
                .expectBody(ListView.class).returnResult().getResponseBody();
        assertThat(reordered.items()).extracting(ListView.Item::id).containsExactlyElementsOf(reversed);

        client.put().uri("/api/lists/{slug}/item-order", slug).header(ListController.TOKEN_HEADER, hostToken)
                .body(new ReorderItems(reversed.subList(0, 2))).exchange()
                .expectStatus().isBadRequest()
                .expectBody().jsonPath("$.code").isEqualTo("INVALID_ORDER");

        // Removing an item gives back everything people had taken of it.
        ListView removed = client.delete().uri("/api/lists/{slug}/items/{id}", slug, vanilla)
                .header(ListController.TOKEN_HEADER, hostToken).exchange()
                .expectStatus().isOk()
                .expectBody(ListView.class).returnResult().getResponseBody();
        assertThat(removed.items()).extracting(ListView.Item::name).doesNotContain("Vanilla bean");
        assertThat(api.view(slug, asha.token()).me().total()).isZero();

        ListView updated = client.put().uri("/api/lists/{slug}", slug).header(ListController.TOKEN_HEADER, hostToken)
                .body(new UpdateList("Friday ice cream", "  ", new ListSettings(false, 3, false), false)).exchange()
                .expectStatus().isOk()
                .expectBody(ListView.class).returnResult().getResponseBody();
        assertThat(updated.title()).isEqualTo("Friday ice cream");
        assertThat(updated.description()).isNull();
        assertThat(updated.settings()).isEqualTo(new ListSettings(false, 3, false));
    }

    @Test
    void hostCanRemoveSomeoneAndTheirPicksAreReleased() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        var asha = api.join(slug, "Asha");
        long vanilla = item(host.list(), "Vanilla").id();
        api.claimOk(slug, asha.token(), vanilla, 2);

        long ashaId = api.view(slug, asha.token()).me().id();
        ListView afterRemoval = client.delete().uri("/api/lists/{slug}/participants/{id}", slug, ashaId)
                .header(ListController.TOKEN_HEADER, host.token()).exchange()
                .expectStatus().isOk()
                .expectBody(ListView.class).returnResult().getResponseBody();
        assertThat(item(afterRemoval, "Vanilla").available()).isEqualTo(2);
        assertThat(afterRemoval.participants()).extracting(ListView.Person::name).containsExactly("Jay");

        // Asha's old token no longer works; she can join again.
        assertThat(api.view(slug, asha.token()).me()).isNull();
        api.claim(slug, asha.token(), vanilla, 1).expectStatus().isUnauthorized();
        api.join(slug, "Asha");

        long hostId = host.list().me().id();
        client.delete().uri("/api/lists/{slug}/participants/{id}", slug, hostId)
                .header(ListController.TOKEN_HEADER, host.token()).exchange()
                .expectStatus().isEqualTo(409);
    }

    @Test
    void closingTheListFreezesIt() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        var asha = api.join(slug, "Asha");
        long vanilla = item(host.list(), "Vanilla").id();
        api.claimOk(slug, asha.token(), vanilla, 1);

        client.put().uri("/api/lists/{slug}", slug).header(ListController.TOKEN_HEADER, host.token())
                .body(new UpdateList("Ice cream order", null, OPEN, true)).exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.closed").isEqualTo(true);

        api.claim(slug, asha.token(), vanilla, 0).expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("LIST_CLOSED");
        client.post().uri("/api/lists/{slug}/participants", slug).body(new Name("Ravi")).exchange()
                .expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("LIST_CLOSED");

        client.put().uri("/api/lists/{slug}", slug).header(ListController.TOKEN_HEADER, host.token())
                .body(new UpdateList("Ice cream order", null, OPEN, false)).exchange()
                .expectStatus().isOk();
        api.claimOk(slug, asha.token(), vanilla, 0);
    }

    @Test
    void namesAreUniquePerListIgnoringCase() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        api.join(slug, "Asha");
        client.post().uri("/api/lists/{slug}/participants", slug).body(new Name("  asha ")).exchange()
                .expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("NAME_TAKEN");
        client.post().uri("/api/lists/{slug}/participants", slug).body(new Name("jay")).exchange()
                .expectStatus().isEqualTo(409);

        // The same name is fine on another list.
        var other = api.create(iceCreamList(OPEN));
        api.join(other.list().slug(), "Asha");
    }

    @Test
    void guestsCanRenameThemselvesAndLeave() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        var asha = api.join(slug, "Asha");
        api.claimOk(slug, asha.token(), item(host.list(), "Vanilla").id(), 1);

        ListView renamed = client.patch().uri("/api/lists/{slug}/participants/me", slug)
                .header(ListController.TOKEN_HEADER, asha.token())
                .body(new Name("Asha K")).exchange()
                .expectStatus().isOk()
                .expectBody(ListView.class).returnResult().getResponseBody();
        assertThat(renamed.me().name()).isEqualTo("Asha K");
        assertThat(item(renamed, "Vanilla").claims()).extracting(ListView.ItemClaim::name).containsExactly("Asha K");

        client.delete().uri("/api/lists/{slug}/participants/me", slug)
                .header(ListController.TOKEN_HEADER, asha.token()).exchange()
                .expectStatus().isNoContent();
        ListView after = api.view(slug, host.token());
        assertThat(item(after, "Vanilla").available()).isEqualTo(2);
        assertThat(after.participantCount()).isEqualTo(1);

        client.delete().uri("/api/lists/{slug}/participants/me", slug)
                .header(ListController.TOKEN_HEADER, host.token()).exchange()
                .expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("HOST_CANNOT_LEAVE");
    }

    @Test
    void deletingAListRemovesIt() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        var asha = api.join(slug, "Asha");
        api.claimOk(slug, asha.token(), item(host.list(), "Vanilla").id(), 1);

        client.delete().uri("/api/lists/{slug}", slug).header(ListController.TOKEN_HEADER, host.token())
                .exchange()
                .expectStatus().isNoContent();
        client.get().uri("/api/lists/{slug}", slug).exchange()
                .expectStatus().isNotFound()
                .expectBody().jsonPath("$.code").isEqualTo("LIST_NOT_FOUND");
    }

    @Test
    void everyChangeBumpsTheRevision() {
        var host = api.create(iceCreamList(OPEN));
        String slug = host.list().slug();
        long start = host.list().revision();
        var asha = api.join(slug, "Asha");
        assertThat(asha.list().revision()).isEqualTo(start + 1);
        long vanilla = item(host.list(), "Vanilla").id();
        assertThat(api.claimOk(slug, asha.token(), vanilla, 1).revision()).isEqualTo(start + 2);
        // Setting the same quantity again is a no-op.
        assertThat(api.claimOk(slug, asha.token(), vanilla, 1).revision()).isEqualTo(start + 2);
        assertThat(api.view(slug, null).revision()).isEqualTo(start + 2);
    }

    @Test
    void rejectsInvalidInputWithFieldErrors() {
        var invalid = new CreateList(" ", null, "Jay", OPEN, List.of(new ItemInput("Vanilla", null, -1)));
        client.post().uri("/api/lists").body(invalid).exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.code").isEqualTo("VALIDATION_FAILED")
                .jsonPath("$.errors[*].field").value(fields ->
                        assertThat(fields.toString()).contains("title", "items[0].quantityLimit"));

        client.post().uri("/api/lists").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("title", "No settings", "hostName", "Jay", "items", List.of())).exchange()
                .expectStatus().isBadRequest();

        var host = api.create(iceCreamList(OPEN));
        api.claim(host.list().slug(), host.token(), item(host.list(), "Vanilla").id(), -1)
                .expectStatus().isBadRequest();
    }

    @Test
    void unknownListsAreNotFound() {
        client.get().uri("/api/lists/{slug}", "zzzzzzzzzz").exchange().expectStatus().isNotFound();
        client.get().uri("/api/lists/{slug}", "bad").exchange().expectStatus().isNotFound();
        client.post().uri("/api/lists/{slug}/participants", "zzzzzzzzzz").body(new Name("Asha")).exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void apiResponsesAreNeverCached() {
        var host = api.create(iceCreamList(OPEN));
        client.get().uri("/api/lists/{slug}", host.list().slug()).exchange()
                .expectHeader().valueEquals("Cache-Control", "no-store");
    }
}
