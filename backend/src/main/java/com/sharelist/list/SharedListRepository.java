package com.sharelist.list;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.LockModeType;

interface SharedListRepository extends JpaRepository<SharedList, Long> {

    Optional<SharedList> findBySlug(String slug);

    /**
     * Loads a list and row-locks it until the transaction ends. Every write to a list goes through
     * this lock, so availability checks and the writes that depend on them can never interleave.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from SharedList l where l.slug = :slug")
    Optional<SharedList> findBySlugForUpdate(String slug);

    boolean existsBySlug(String slug);

    @Transactional
    @Modifying
    @Query("delete from SharedList l where l.updatedAt < :cutoff")
    int deleteInactiveSince(Instant cutoff);
}
