package com.sharelist.list;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface ParticipantRepository extends JpaRepository<Participant, Long> {

    List<Participant> findByListIdOrderByJoinedAtAscIdAsc(Long listId);
}
