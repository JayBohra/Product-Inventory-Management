package com.sharelist.list;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import com.sharelist.common.ApiException;
import com.sharelist.common.ErrorCode;
import com.sharelist.common.Tokens;
import com.sharelist.config.AppProperties;
import com.sharelist.list.ListRequests.CreateList;
import com.sharelist.list.ListRequests.ItemInput;
import com.sharelist.list.ListRequests.UpdateList;

/**
 * All reads and writes of lists.
 *
 * <p>Every write starts by row-locking the list ({@code SELECT ... FOR UPDATE}), which serialises
 * concurrent changes to the same list. That is what guarantees that two people tapping "+" on the
 * last vanilla at the same moment can't both get it: the second transaction waits, then sees the
 * first one's claim and is rejected. Different lists never block each other.
 */
@Service
public class ListService {

    private final SharedListRepository lists;
    private final ListItemRepository items;
    private final ParticipantRepository participants;
    private final ClaimRepository claims;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final AppProperties.Limits limits;

    ListService(SharedListRepository lists, ListItemRepository items, ParticipantRepository participants,
            ClaimRepository claims, ApplicationEventPublisher events, Clock clock, AppProperties properties) {
        this.lists = lists;
        this.items = items;
        this.participants = participants;
        this.claims = claims;
        this.events = events;
        this.clock = clock;
        this.limits = properties.limits();
    }

    // ---------------------------------------------------------------- reads

    /** Repeatable read gives the four queries behind a view one consistent snapshot. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ListView view(String slug, String token) {
        ListSnapshot snapshot = load(findList(slug));
        return ListViews.assemble(snapshot, snapshot.participantByToken(token).orElse(null));
    }

    @Transactional(readOnly = true)
    public Optional<Long> currentRevision(String slug) {
        if (!Tokens.looksLikeSlug(slug)) {
            return Optional.empty();
        }
        return lists.findBySlug(slug).map(SharedList::getRevision);
    }

    // ---------------------------------------------------------------- creating and joining

    @Transactional
    public ListView.WithToken create(CreateList request) {
        if (request.items().size() > limits.maxItemsPerList()) {
            throw tooManyItems();
        }
        Instant now = clock.instant();
        SharedList list = lists.save(new SharedList(newUniqueSlug(), clean(request.title()),
                cleanOptional(request.description()), request.settings(), now));

        String token = Tokens.newSecret();
        Participant host = participants.save(
                Participant.host(list.getId(), clean(request.hostName()), Tokens.hash(token), now));

        ListSnapshot snapshot = new ListSnapshot(list, List.of(), List.of(host), List.of());
        int position = 0;
        for (ItemInput input : request.items()) {
            String name = clean(input.name());
            requireItemNameAvailable(snapshot, name, null);
            snapshot.items().add(items.save(new ListItem(list.getId(), name, cleanOptional(input.note()),
                    input.quantityLimit(), position++, now)));
        }
        return new ListView.WithToken(token, ListViews.assemble(snapshot, host));
    }

    @Transactional
    public ListView.WithToken join(String slug, String displayName) {
        ListSnapshot snapshot = lockAndLoad(slug);
        SharedList list = snapshot.list();
        if (list.isClosed()) {
            throw new ApiException(ErrorCode.LIST_CLOSED, "This list is closed, so new people can't join right now.");
        }
        if (snapshot.participants().size() >= limits.maxParticipantsPerList()) {
            throw new ApiException(ErrorCode.TOO_MANY_PARTICIPANTS, "This list is full.");
        }
        String name = clean(displayName);
        requireParticipantNameAvailable(snapshot, name, null);

        String token = Tokens.newSecret();
        Participant participant = participants.save(
                Participant.guest(list.getId(), name, Tokens.hash(token), clock.instant()));
        snapshot.participants().add(participant);
        changed(list);
        return new ListView.WithToken(token, ListViews.assemble(snapshot, participant));
    }

    @Transactional
    public ListView rename(String slug, String token, String displayName) {
        ListSnapshot snapshot = lockAndLoad(slug);
        Participant me = snapshot.requireParticipant(token);
        String name = clean(displayName);
        if (!name.equals(me.getDisplayName())) {
            requireParticipantNameAvailable(snapshot, name, me.getId());
            me.rename(name);
            changed(snapshot.list());
        }
        return ListViews.assemble(snapshot, me);
    }

    @Transactional
    public void leave(String slug, String token) {
        ListSnapshot snapshot = lockAndLoad(slug);
        Participant me = snapshot.requireParticipant(token);
        if (me.isHost()) {
            throw new ApiException(ErrorCode.HOST_CANNOT_LEAVE,
                    "As the host you can't leave your own list, but you can delete it.");
        }
        if (snapshot.list().isClosed()) {
            throw new ApiException(ErrorCode.LIST_CLOSED, "This list is closed, so you can't leave right now.");
        }
        removeParticipant(snapshot, me);
        changed(snapshot.list());
    }

    // ---------------------------------------------------------------- picking items

    /** Sets how many units of an item the caller holds (0 gives them all back). */
    @Transactional
    public ListView setClaim(String slug, String token, long itemId, int quantity) {
        ListSnapshot snapshot = lockAndLoad(slug);
        SharedList list = snapshot.list();
        Participant me = snapshot.requireParticipant(token);
        ListItem item = snapshot.requireItem(itemId);

        Optional<Claim> existing = snapshot.claim(item.getId(), me.getId());
        int current = existing.map(Claim::getQuantity).orElse(0);
        if (current == quantity) {
            return ListViews.assemble(snapshot, me);
        }
        ClaimRules.checkChange(list, item, current, quantity,
                snapshot.claimedOf(item.getId()), snapshot.totalOf(me.getId()));

        Instant now = clock.instant();
        if (quantity == 0) {
            claims.delete(existing.orElseThrow());
            snapshot.claims().remove(existing.get());
        } else if (existing.isPresent()) {
            existing.get().changeQuantity(quantity, now);
        } else {
            snapshot.claims().add(claims.save(new Claim(list.getId(), item.getId(), me.getId(), quantity, now)));
        }
        changed(list);
        return ListViews.assemble(snapshot, me);
    }

    // ---------------------------------------------------------------- host only

    @Transactional
    public ListView update(String slug, String token, UpdateList request) {
        ListSnapshot snapshot = lockAndLoad(slug);
        Participant host = snapshot.requireHost(token);
        snapshot.list().update(clean(request.title()), cleanOptional(request.description()),
                request.settings(), request.closed());
        changed(snapshot.list());
        return ListViews.assemble(snapshot, host);
    }

    @Transactional
    public ListView addItem(String slug, String token, ItemInput input) {
        ListSnapshot snapshot = lockAndLoad(slug);
        Participant host = snapshot.requireHost(token);
        if (snapshot.items().size() >= limits.maxItemsPerList()) {
            throw tooManyItems();
        }
        String name = clean(input.name());
        requireItemNameAvailable(snapshot, name, null);
        int position = snapshot.items().stream().mapToInt(ListItem::getPosition).max().orElse(-1) + 1;
        snapshot.items().add(items.save(new ListItem(snapshot.list().getId(), name, cleanOptional(input.note()),
                input.quantityLimit(), position, clock.instant())));
        changed(snapshot.list());
        return ListViews.assemble(snapshot, host);
    }

    @Transactional
    public ListView updateItem(String slug, String token, long itemId, ItemInput input) {
        ListSnapshot snapshot = lockAndLoad(slug);
        Participant host = snapshot.requireHost(token);
        ListItem item = snapshot.requireItem(itemId);
        String name = clean(input.name());
        requireItemNameAvailable(snapshot, name, item.getId());
        int claimed = snapshot.claimedOf(item.getId());
        if (input.quantityLimit() != null && input.quantityLimit() < claimed) {
            throw new ApiException(ErrorCode.LIMIT_BELOW_CLAIMED,
                    "%d of \"%s\" are already taken, so the limit can't be lower than %d."
                            .formatted(claimed, item.getName(), claimed),
                    Map.of("claimed", claimed));
        }
        item.update(name, cleanOptional(input.note()), input.quantityLimit());
        changed(snapshot.list());
        return ListViews.assemble(snapshot, host);
    }

    @Transactional
    public ListView removeItem(String slug, String token, long itemId) {
        ListSnapshot snapshot = lockAndLoad(slug);
        Participant host = snapshot.requireHost(token);
        ListItem item = snapshot.requireItem(itemId);
        List<Claim> itemClaims = snapshot.claimsOfItem(item.getId());
        claims.deleteAll(itemClaims);
        snapshot.claims().removeAll(itemClaims);
        items.delete(item);
        snapshot.items().remove(item);
        changed(snapshot.list());
        return ListViews.assemble(snapshot, host);
    }

    @Transactional
    public ListView reorderItems(String slug, String token, List<Long> itemIds) {
        ListSnapshot snapshot = lockAndLoad(slug);
        Participant host = snapshot.requireHost(token);
        var existingIds = new HashSet<Long>();
        snapshot.items().forEach(item -> existingIds.add(item.getId()));
        if (itemIds.size() != existingIds.size() || !existingIds.equals(new HashSet<>(itemIds))) {
            throw new ApiException(ErrorCode.INVALID_ORDER,
                    "The list changed while you were reordering. Please try again.");
        }
        for (int position = 0; position < itemIds.size(); position++) {
            snapshot.requireItem(itemIds.get(position)).moveTo(position);
        }
        snapshot.items().sort(Comparator.comparingInt(ListItem::getPosition));
        changed(snapshot.list());
        return ListViews.assemble(snapshot, host);
    }

    @Transactional
    public ListView removeParticipant(String slug, String token, long participantId) {
        ListSnapshot snapshot = lockAndLoad(slug);
        Participant host = snapshot.requireHost(token);
        Participant participant = snapshot.requireParticipantById(participantId);
        if (participant.isHost()) {
            throw new ApiException(ErrorCode.HOST_CANNOT_LEAVE, "The host can't be removed from the list.");
        }
        removeParticipant(snapshot, participant);
        changed(snapshot.list());
        return ListViews.assemble(snapshot, host);
    }

    @Transactional
    public void delete(String slug, String token) {
        ListSnapshot snapshot = lockAndLoad(slug);
        snapshot.requireHost(token);
        // Items, participants and claims go with it (ON DELETE CASCADE).
        lists.delete(snapshot.list());
        events.publishEvent(new ListEvents.Deleted(slug));
    }

    // ---------------------------------------------------------------- helpers

    private SharedList findList(String slug) {
        if (!Tokens.looksLikeSlug(slug)) {
            throw listNotFound();
        }
        return lists.findBySlug(slug).orElseThrow(ListService::listNotFound);
    }

    private ListSnapshot lockAndLoad(String slug) {
        if (!Tokens.looksLikeSlug(slug)) {
            throw listNotFound();
        }
        return load(lists.findBySlugForUpdate(slug).orElseThrow(ListService::listNotFound));
    }

    private ListSnapshot load(SharedList list) {
        return new ListSnapshot(list,
                items.findByListIdOrderByPositionAscIdAsc(list.getId()),
                participants.findByListIdOrderByJoinedAtAscIdAsc(list.getId()),
                claims.findByListId(list.getId()));
    }

    private void removeParticipant(ListSnapshot snapshot, Participant participant) {
        List<Claim> theirClaims = snapshot.claimsOfParticipant(participant.getId());
        claims.deleteAll(theirClaims);
        snapshot.claims().removeAll(theirClaims);
        participants.delete(participant);
        snapshot.participants().remove(participant);
    }

    /** Bumps the revision and tells live viewers (after the transaction commits). */
    private void changed(SharedList list) {
        list.markChanged(clock.instant());
        events.publishEvent(new ListEvents.Changed(list.getSlug(), list.getRevision()));
    }

    private String newUniqueSlug() {
        for (int attempt = 0; attempt < 5; attempt++) {
            String slug = Tokens.newSlug();
            if (!lists.existsBySlug(slug)) {
                return slug;
            }
        }
        throw new IllegalStateException("Could not generate a unique list code");
    }

    private static void requireParticipantNameAvailable(ListSnapshot snapshot, String name, Long exceptId) {
        if (snapshot.participantNameTaken(name, exceptId)) {
            throw new ApiException(ErrorCode.NAME_TAKEN,
                    "Someone called \"%s\" has already joined. Please add an initial or a nickname."
                            .formatted(name));
        }
    }

    private static void requireItemNameAvailable(ListSnapshot snapshot, String name, Long exceptId) {
        if (snapshot.itemNameTaken(name, exceptId)) {
            throw new ApiException(ErrorCode.ITEM_NAME_TAKEN, "\"%s\" is already on the list.".formatted(name));
        }
    }

    private ApiException tooManyItems() {
        int max = limits.maxItemsPerList();
        return new ApiException(ErrorCode.TOO_MANY_ITEMS,
                "A list can have at most %d %s.".formatted(max, max == 1 ? "item" : "items"));
    }

    private static ApiException listNotFound() {
        return new ApiException(ErrorCode.LIST_NOT_FOUND, "This list doesn't exist or was deleted by the host.");
    }

    /** Trims and collapses runs of whitespace (including newlines) into single spaces. */
    static String clean(String value) {
        return value.strip().replaceAll("\\s+", " ");
    }

    /** Trims free text (keeping line breaks) and turns blank values into {@code null}. */
    static String cleanOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.strip().replace("\r\n", "\n").replace('\r', '\n').replaceAll("\n{3,}", "\n\n");
    }
}
