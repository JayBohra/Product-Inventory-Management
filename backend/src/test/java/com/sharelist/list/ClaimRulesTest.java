package com.sharelist.list;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.sharelist.common.ApiException;
import com.sharelist.common.ErrorCode;

class ClaimRulesTest {

    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");

    private static SharedList list(boolean multiple, Integer perPerson) {
        return new SharedList("abcdefghij", "Ice cream", null, new ListSettings(multiple, perPerson, true), NOW);
    }

    private static ListItem item(Integer stock) {
        return new ListItem(1L, "Vanilla", null, stock, 0, NOW);
    }

    @Test
    void allowsTakingWhatIsAvailable() {
        assertThatCode(() -> ClaimRules.checkChange(list(true, null), item(2), 0, 2, 0, 0))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsTakingMoreThanIsLeft() {
        assertThatThrownBy(() -> ClaimRules.checkChange(list(true, null), item(2), 0, 2, 1, 0))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.code()).isEqualTo(ErrorCode.NOT_ENOUGH_LEFT);
                    assertThat(e.getMessage()).isEqualTo("Only 1 of \"Vanilla\" left.");
                    assertThat(e.details()).containsEntry("available", 1);
                });
    }

    @Test
    void explainsWhenAnItemIsSoldOut() {
        assertThatThrownBy(() -> ClaimRules.checkChange(list(true, null), item(2), 0, 1, 2, 0))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.code()).isEqualTo(ErrorCode.NOT_ENOUGH_LEFT);
                    assertThat(e.getMessage()).isEqualTo("Sorry, \"Vanilla\" is all taken.");
                });
    }

    @Test
    void countsOnlyTheExtraUnitsAgainstStock() {
        // Holding 1 of a 2-unit item and going to 2 needs just 1 more unit, which is free.
        assertThatCode(() -> ClaimRules.checkChange(list(true, null), item(2), 1, 2, 1, 1))
                .doesNotThrowAnyException();
    }

    @Test
    void enforcesThePerPersonLimitAcrossItems() {
        assertThatThrownBy(() -> ClaimRules.checkChange(list(true, 2), item(null), 0, 1, 5, 2))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.code()).isEqualTo(ErrorCode.PERSON_LIMIT_REACHED);
                    assertThat(e.getMessage()).isEqualTo("You've reached the limit of 2 items per person.");
                    assertThat(e.details()).containsEntry("remaining", 0);
                });
        assertThatThrownBy(() -> ClaimRules.checkChange(list(true, 3), item(null), 0, 2, 0, 2))
                .isInstanceOfSatisfying(ApiException.class, e ->
                        assertThat(e.getMessage()).isEqualTo("You can take only 1 more item (limit is 3 per person)."));
    }

    @Test
    void oneOfEachItemWhenCountsAreOff() {
        assertThatCode(() -> ClaimRules.checkChange(list(false, null), item(null), 0, 1, 0, 0))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> ClaimRules.checkChange(list(false, null), item(null), 1, 2, 1, 1))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo(ErrorCode.ONE_PER_ITEM));
    }

    @Test
    void givingBackIsAlwaysAllowedEvenAboveLimits() {
        // e.g. the host lowered the per-person limit after this participant took 3.
        assertThatCode(() -> ClaimRules.checkChange(list(false, 1), item(1), 3, 2, 3, 3))
                .doesNotThrowAnyException();
    }

    @Test
    void closedListsRejectAnyChange() {
        SharedList list = list(true, null);
        list.update("Ice cream", null, list.settings(), true);
        assertThatThrownBy(() -> ClaimRules.checkChange(list, item(null), 1, 0, 1, 1))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo(ErrorCode.LIST_CLOSED));
    }
}
