package com.sharelist.list;

import static com.sharelist.list.TestApi.iceCreamList;
import static com.sharelist.list.TestApi.item;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.client.RestTestClient;

import com.sharelist.TestcontainersConfiguration;
import com.sharelist.list.ListRequests.CreateList;
import com.sharelist.list.ListRequests.ItemInput;

/** Fires many simultaneous requests to prove that limits hold under contention. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@Import(TestcontainersConfiguration.class)
class ConcurrentClaimsIntegrationTest {

    @Autowired
    private RestTestClient client;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(client);
    }

    @Test
    void theLastUnitsCannotBeOversold() throws Exception {
        var host = api.create(iceCreamList(new ListSettings(true, null, true)));
        String slug = host.list().slug();
        long vanilla = item(host.list(), "Vanilla").id();
        List<String> tokens = joinMany(slug, 24);

        List<Integer> statuses = runAtOnce(tokens.stream()
                .<Callable<Integer>>map(token -> () -> api.claimStatus(slug, token, vanilla, 1))
                .toList());

        assertThat(statuses).filteredOn(status -> status == 200).hasSize(2);
        assertThat(statuses).filteredOn(TestApi::isConflict).hasSize(22);
        ListView.Item after = item(api.view(slug, host.token()), "Vanilla");
        assertThat(after.claimed()).isEqualTo(2);
        assertThat(after.available()).isZero();
        assertThat(after.claims()).hasSize(2);
    }

    @Test
    void thePerPersonLimitHoldsAcrossSimultaneousRequests() throws Exception {
        List<ItemInput> flavours = List.of("Vanilla", "Chocolate", "Strawberry", "Mango", "Pistachio", "Coffee")
                .stream().map(name -> new ItemInput(name, null, null)).toList();
        var host = api.create(new CreateList("One scoop each", null, "Jay", new ListSettings(true, 1, true), flavours));
        String slug = host.list().slug();
        String asha = api.join(slug, "Asha").token();

        List<Integer> statuses = runAtOnce(host.list().items().stream()
                .<Callable<Integer>>map(item -> () -> api.claimStatus(slug, asha, item.id(), 1))
                .toList());

        assertThat(statuses).filteredOn(status -> status == 200).hasSize(1);
        assertThat(api.view(slug, asha).me().total()).isEqualTo(1);
    }

    @Test
    void simultaneousPicksOfAnUnlimitedItemAreAllCounted() throws Exception {
        var host = api.create(iceCreamList(new ListSettings(true, null, true)));
        String slug = host.list().slug();
        long chocolate = item(host.list(), "Chocolate").id();
        List<String> tokens = joinMany(slug, 20);

        List<Integer> statuses = runAtOnce(tokens.stream()
                .<Callable<Integer>>map(token -> () -> api.claimStatus(slug, token, chocolate, 2))
                .toList());

        assertThat(statuses).containsOnly(200);
        assertThat(item(api.view(slug, host.token()), "Chocolate").claimed()).isEqualTo(40);
    }

    private List<String> joinMany(String slug, int count) {
        List<String> tokens = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            tokens.add(api.join(slug, "Guest " + i).token());
        }
        return tokens;
    }

    /** Starts all tasks at the same instant to maximise contention. */
    private static <T> List<T> runAtOnce(List<Callable<T>> tasks) throws Exception {
        CountDownLatch ready = new CountDownLatch(tasks.size());
        CountDownLatch go = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(tasks.size())) {
            List<Future<T>> futures = new ArrayList<>();
            for (Callable<T> task : tasks) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    return task.call();
                }));
            }
            ready.await();
            go.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> future : futures) {
                results.add(future.get());
            }
            return results;
        }
    }
}
