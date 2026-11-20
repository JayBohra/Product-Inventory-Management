/** Shapes of the JSON exchanged with the backend (see ListView.java / ListRequests.java). */

export interface ListSettings {
  /** People may take more than one unit of the same item. */
  allowMultiplePerItem: boolean;
  /** Most units one person may take across the whole list; null means no limit. */
  maxPerParticipant: number | null;
  /** Everyone (not just the host) can see who took what. */
  showClaimants: boolean;
}

export interface ItemClaim {
  participantId: number;
  name: string;
  quantity: number;
}

export interface ListItem {
  id: number;
  name: string;
  note: string | null;
  /** Total units available; null means unlimited. */
  quantityLimit: number | null;
  claimed: number;
  /** Units still free; null means unlimited. */
  available: number | null;
  myQuantity: number;
  /** Null when the viewer isn't allowed to see who took what. */
  claims: ItemClaim[] | null;
}

export interface Me {
  id: number;
  name: string;
  host: boolean;
  total: number;
  /** How many more units this person may take; null means no limit. */
  remaining: number | null;
}

export interface Person {
  id: number;
  name: string;
  host: boolean;
  total: number;
  joinedAt: string;
}

export interface ListView {
  slug: string;
  title: string;
  description: string | null;
  hostName: string;
  settings: ListSettings;
  closed: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  items: ListItem[];
  participantCount: number;
  claimedTotal: number;
  /** Null until the viewer joins. */
  me: Me | null;
  /** Null unless the viewer is the host or the host made picks public. */
  participants: Person[] | null;
}

export interface WithToken {
  token: string;
  list: ListView;
}

export interface ItemInput {
  name: string;
  note: string | null;
  quantityLimit: number | null;
}

export interface CreateListRequest {
  title: string;
  description: string | null;
  hostName: string;
  settings: ListSettings;
  items: ItemInput[];
}

export interface UpdateListRequest {
  title: string;
  description: string | null;
  settings: ListSettings;
  closed: boolean;
}
