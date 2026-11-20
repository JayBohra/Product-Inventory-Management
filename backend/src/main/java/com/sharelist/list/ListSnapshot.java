package com.sharelist.list;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import com.sharelist.common.ApiException;
import com.sharelist.common.ErrorCode;
import com.sharelist.common.Tokens;

/**
 * Everything that belongs to one list, loaded together so that rules and views work on one
 * consistent state. Lists are small (hundreds of rows at most), so this is cheap.
 */
final class ListSnapshot {

    private final SharedList list;
    private final List<ListItem> items;
    private final List<Participant> participants;
    private final List<Claim> claims;

    ListSnapshot(SharedList list, List<ListItem> items, List<Participant> participants, List<Claim> claims) {
        this.list = list;
        this.items = new ArrayList<>(items);
        this.participants = new ArrayList<>(participants);
        this.claims = new ArrayList<>(claims);
    }

    SharedList list() {
        return list;
    }

    List<ListItem> items() {
        return items;
    }

    List<Participant> participants() {
        return participants;
    }

    List<Claim> claims() {
        return claims;
    }

    Participant host() {
        return participants.stream()
                .filter(Participant::isHost)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("List " + list.getSlug() + " has no host"));
    }

    Optional<Participant> participantByToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        String hash = Tokens.hash(token.strip());
        return participants.stream().filter(p -> p.getTokenHash().equals(hash)).findFirst();
    }

    Participant requireParticipant(String token) {
        return participantByToken(token).orElseThrow(() -> new ApiException(ErrorCode.NOT_JOINED,
                "Please join the list with your name first."));
    }

    Participant requireHost(String token) {
        Participant participant = requireParticipant(token);
        if (!participant.isHost()) {
            throw new ApiException(ErrorCode.HOST_ONLY, "Only the host can change this.");
        }
        return participant;
    }

    Participant requireParticipantById(long participantId) {
        return participants.stream()
                .filter(p -> p.getId() == participantId)
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.PARTICIPANT_NOT_FOUND,
                        "That person is no longer part of this list."));
    }

    ListItem requireItem(long itemId) {
        return items.stream()
                .filter(item -> item.getId() == itemId)
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.ITEM_NOT_FOUND,
                        "That item is no longer on the list."));
    }

    Optional<Claim> claim(long itemId, long participantId) {
        return claims.stream()
                .filter(c -> c.getItemId() == itemId && c.getParticipantId() == participantId)
                .findFirst();
    }

    List<Claim> claimsOfItem(long itemId) {
        return claims.stream().filter(c -> c.getItemId() == itemId).toList();
    }

    List<Claim> claimsOfParticipant(long participantId) {
        return claims.stream().filter(c -> c.getParticipantId() == participantId).toList();
    }

    int claimedOf(long itemId) {
        return claims.stream().filter(c -> c.getItemId() == itemId).mapToInt(Claim::getQuantity).sum();
    }

    int totalOf(long participantId) {
        return claims.stream().filter(c -> c.getParticipantId() == participantId).mapToInt(Claim::getQuantity).sum();
    }

    boolean participantNameTaken(String name, Long exceptParticipantId) {
        return participants.stream()
                .filter(p -> !Objects.equals(p.getId(), exceptParticipantId))
                .anyMatch(p -> p.getDisplayName().equalsIgnoreCase(name));
    }

    boolean itemNameTaken(String name, Long exceptItemId) {
        return items.stream()
                .filter(item -> !Objects.equals(item.getId(), exceptItemId))
                .anyMatch(item -> item.getName().equalsIgnoreCase(name));
    }
}
