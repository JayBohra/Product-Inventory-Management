package com.sharelist.list;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface ListItemRepository extends JpaRepository<ListItem, Long> {

    List<ListItem> findByListIdOrderByPositionAscIdAsc(Long listId);
}
