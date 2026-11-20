package com.sharelist.list;

/** Application events published by {@link ListService}; listeners receive them after the commit. */
public final class ListEvents {

    private ListEvents() {
    }

    public record Changed(String slug, long revision) {
    }

    public record Deleted(String slug) {
    }
}
