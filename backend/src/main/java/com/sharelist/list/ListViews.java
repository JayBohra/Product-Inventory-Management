package com.sharelist.list;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Turns a {@link ListSnapshot} into what a particular viewer is allowed to see. */
final class ListViews {

    private ListViews() {
    }

    /** @param viewer the participant looking at the list, or {@code null} for someone who hasn't joined */
    static ListView assemble(ListSnapshot snapshot, Participant viewer) {
        SharedList list = snapshot.list();
        boolean revealClaimants = list.isShowClaimants() || (viewer != null && viewer.isHost());

        List<Participant> participants = snapshot.participants();
        Map<Long, Participant> participantsById = participants.stream()
                .collect(Collectors.toMap(Participant::getId, Function.identity()));
        Map<Long, Integer> joinOrder = new HashMap<>();
        for (int i = 0; i < participants.size(); i++) {
            joinOrder.put(participants.get(i).getId(), i);
        }
        Map<Long, Integer> totals = snapshot.claims().stream()
                .collect(Collectors.groupingBy(Claim::getParticipantId, Collectors.summingInt(Claim::getQuantity)));
        Map<Long, List<Claim>> claimsByItem = snapshot.claims().stream()
                .sorted(Comparator.comparing(claim -> joinOrder.getOrDefault(claim.getParticipantId(), Integer.MAX_VALUE)))
                .collect(Collectors.groupingBy(Claim::getItemId));

        List<ListView.Item> items = snapshot.items().stream()
                .map(item -> {
                    List<Claim> claims = claimsByItem.getOrDefault(item.getId(), List.of());
                    int claimed = claims.stream().mapToInt(Claim::getQuantity).sum();
                    Integer available = item.getQuantityLimit() == null
                            ? null
                            : Math.max(0, item.getQuantityLimit() - claimed);
                    int mine = viewer == null ? 0 : claims.stream()
                            .filter(claim -> claim.getParticipantId().equals(viewer.getId()))
                            .mapToInt(Claim::getQuantity)
                            .sum();
                    List<ListView.ItemClaim> visibleClaims = revealClaimants
                            ? claims.stream()
                                    .map(claim -> new ListView.ItemClaim(claim.getParticipantId(),
                                            participantsById.get(claim.getParticipantId()).getDisplayName(),
                                            claim.getQuantity()))
                                    .toList()
                            : null;
                    return new ListView.Item(item.getId(), item.getName(), item.getNote(), item.getQuantityLimit(),
                            claimed, available, mine, visibleClaims);
                })
                .toList();

        ListView.Me me = null;
        if (viewer != null) {
            int total = totals.getOrDefault(viewer.getId(), 0);
            Integer limit = list.getMaxPerParticipant();
            me = new ListView.Me(viewer.getId(), viewer.getDisplayName(), viewer.isHost(), total,
                    limit == null ? null : Math.max(0, limit - total));
        }

        List<ListView.Person> people = revealClaimants
                ? participants.stream()
                        .map(p -> new ListView.Person(p.getId(), p.getDisplayName(), p.isHost(),
                                totals.getOrDefault(p.getId(), 0), p.getJoinedAt()))
                        .toList()
                : null;

        int claimedTotal = snapshot.claims().stream().mapToInt(Claim::getQuantity).sum();

        return new ListView(list.getSlug(), list.getTitle(), list.getDescription(),
                snapshot.host().getDisplayName(), list.settings(), list.isClosed(), list.getRevision(),
                list.getCreatedAt(), list.getUpdatedAt(), items, participants.size(), claimedTotal, me, people);
    }
}
