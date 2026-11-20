package com.sharelist.list;

import java.time.Instant;
import java.util.List;

/**
 * A list as seen by one viewer. Who-took-what details ({@link Item#claims()} and
 * {@link #participants()}) are {@code null} unless the viewer is the host or the host made them public.
 *
 * @param revision increases on every change; clients compare it with real-time notifications
 * @param me       the viewer, or {@code null} if they haven't joined
 */
public record ListView(
        String slug,
        String title,
        String description,
        String hostName,
        ListSettings settings,
        boolean closed,
        long revision,
        Instant createdAt,
        Instant updatedAt,
        List<Item> items,
        int participantCount,
        int claimedTotal,
        Me me,
        List<Person> participants) {

    /**
     * @param quantityLimit total units, or {@code null} for unlimited
     * @param available     units still free, or {@code null} for unlimited
     * @param myQuantity    units the viewer holds
     */
    public record Item(
            long id,
            String name,
            String note,
            Integer quantityLimit,
            int claimed,
            Integer available,
            int myQuantity,
            List<ItemClaim> claims) {
    }

    public record ItemClaim(long participantId, String name, int quantity) {
    }

    /** @param remaining how many more units the viewer may take, or {@code null} for no limit */
    public record Me(long id, String name, boolean host, int total, Integer remaining) {
    }

    public record Person(long id, String name, boolean host, int total, Instant joinedAt) {
    }

    /** Returned when someone creates or joins a list: the secret token identifies them from now on. */
    public record WithToken(String token, ListView list) {
    }
}
