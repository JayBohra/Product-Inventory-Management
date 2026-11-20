package com.sharelist.common;

import org.springframework.http.HttpStatus;

/** Machine-readable error codes returned in the {@code code} field of problem responses. */
public enum ErrorCode {
    LIST_NOT_FOUND(HttpStatus.NOT_FOUND, "List not found"),
    ITEM_NOT_FOUND(HttpStatus.NOT_FOUND, "Item not found"),
    PARTICIPANT_NOT_FOUND(HttpStatus.NOT_FOUND, "Participant not found"),
    NOT_JOINED(HttpStatus.UNAUTHORIZED, "Join the list first"),
    HOST_ONLY(HttpStatus.FORBIDDEN, "Only the host can do this"),
    LIST_CLOSED(HttpStatus.CONFLICT, "List is closed"),
    NOT_ENOUGH_LEFT(HttpStatus.CONFLICT, "Not enough left"),
    PERSON_LIMIT_REACHED(HttpStatus.CONFLICT, "Personal limit reached"),
    ONE_PER_ITEM(HttpStatus.CONFLICT, "One per item"),
    LIMIT_BELOW_CLAIMED(HttpStatus.CONFLICT, "Limit is lower than what's already taken"),
    NAME_TAKEN(HttpStatus.CONFLICT, "Name already taken"),
    ITEM_NAME_TAKEN(HttpStatus.CONFLICT, "Item already exists"),
    TOO_MANY_ITEMS(HttpStatus.CONFLICT, "Too many items"),
    TOO_MANY_PARTICIPANTS(HttpStatus.CONFLICT, "Too many participants"),
    HOST_CANNOT_LEAVE(HttpStatus.CONFLICT, "The host can't leave"),
    INVALID_ORDER(HttpStatus.BAD_REQUEST, "Invalid item order"),
    CONFLICT(HttpStatus.CONFLICT, "Conflicting change");

    private final HttpStatus status;
    private final String title;

    ErrorCode(HttpStatus status, String title) {
        this.status = status;
        this.title = title;
    }

    public HttpStatus status() {
        return status;
    }

    public String title() {
        return title;
    }
}
