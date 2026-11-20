package com.sharelist.list;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface ClaimRepository extends JpaRepository<Claim, Long> {

    List<Claim> findByListId(Long listId);
}
