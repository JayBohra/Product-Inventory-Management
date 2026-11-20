package com.sharelist.list;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.sharelist.list.ListRequests.CreateList;
import com.sharelist.list.ListRequests.ItemInput;
import com.sharelist.list.ListRequests.Name;
import com.sharelist.list.ListRequests.ReorderItems;
import com.sharelist.list.ListRequests.SetClaim;
import com.sharelist.list.ListRequests.UpdateList;

import jakarta.validation.Valid;

/**
 * REST API for lists. Callers identify themselves with the secret token they received when they
 * created or joined the list, sent in the {@value #TOKEN_HEADER} header.
 */
@RestController
@RequestMapping(path = "/api/lists", produces = MediaType.APPLICATION_JSON_VALUE)
public class ListController {

    public static final String TOKEN_HEADER = "X-Participant-Token";

    private final ListService service;

    ListController(ListService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ListView.WithToken create(@Valid @RequestBody CreateList request) {
        return service.create(request);
    }

    @GetMapping("/{slug}")
    ListView get(@PathVariable String slug, @RequestHeader(name = TOKEN_HEADER, required = false) String token) {
        return service.view(slug, token);
    }

    @PutMapping("/{slug}")
    ListView update(@PathVariable String slug, @RequestHeader(name = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody UpdateList request) {
        return service.update(slug, token, request);
    }

    @DeleteMapping("/{slug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable String slug, @RequestHeader(name = TOKEN_HEADER, required = false) String token) {
        service.delete(slug, token);
    }

    // ---------------------------------------------------------------- participants

    @PostMapping("/{slug}/participants")
    @ResponseStatus(HttpStatus.CREATED)
    ListView.WithToken join(@PathVariable String slug, @Valid @RequestBody Name request) {
        return service.join(slug, request.displayName());
    }

    @PatchMapping("/{slug}/participants/me")
    ListView rename(@PathVariable String slug, @RequestHeader(name = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody Name request) {
        return service.rename(slug, token, request.displayName());
    }

    @DeleteMapping("/{slug}/participants/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void leave(@PathVariable String slug, @RequestHeader(name = TOKEN_HEADER, required = false) String token) {
        service.leave(slug, token);
    }

    @DeleteMapping("/{slug}/participants/{participantId}")
    ListView removeParticipant(@PathVariable String slug, @PathVariable long participantId,
            @RequestHeader(name = TOKEN_HEADER, required = false) String token) {
        return service.removeParticipant(slug, token, participantId);
    }

    // ---------------------------------------------------------------- items

    @PutMapping("/{slug}/items/{itemId}/claim")
    ListView setClaim(@PathVariable String slug, @PathVariable long itemId,
            @RequestHeader(name = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody SetClaim request) {
        return service.setClaim(slug, token, itemId, request.quantity());
    }

    @PostMapping("/{slug}/items")
    @ResponseStatus(HttpStatus.CREATED)
    ListView addItem(@PathVariable String slug, @RequestHeader(name = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody ItemInput request) {
        return service.addItem(slug, token, request);
    }

    @PutMapping("/{slug}/items/{itemId}")
    ListView updateItem(@PathVariable String slug, @PathVariable long itemId,
            @RequestHeader(name = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody ItemInput request) {
        return service.updateItem(slug, token, itemId, request);
    }

    @DeleteMapping("/{slug}/items/{itemId}")
    ListView removeItem(@PathVariable String slug, @PathVariable long itemId,
            @RequestHeader(name = TOKEN_HEADER, required = false) String token) {
        return service.removeItem(slug, token, itemId);
    }

    @PutMapping("/{slug}/item-order")
    ListView reorderItems(@PathVariable String slug, @RequestHeader(name = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody ReorderItems request) {
        return service.reorderItems(slug, token, request.itemIds());
    }
}
