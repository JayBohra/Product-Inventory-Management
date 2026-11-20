import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { ApiError } from './api-error';
import {
  CreateListRequest,
  ItemInput,
  ListView,
  UpdateListRequest,
  WithToken,
} from './models';

export const TOKEN_HEADER = 'X-Participant-Token';
const BASE = '/api/lists';

/** Typed access to the REST API. Every method rejects with an {@link ApiError}. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  createList(request: CreateListRequest): Promise<WithToken> {
    return this.call(this.http.post<WithToken>(BASE, request));
  }

  getList(slug: string, token: string | null): Promise<ListView> {
    return this.call(this.http.get<ListView>(this.url(slug), { headers: auth(token) }));
  }

  join(slug: string, displayName: string): Promise<WithToken> {
    return this.call(this.http.post<WithToken>(this.url(slug, 'participants'), { displayName }));
  }

  rename(slug: string, token: string, displayName: string): Promise<ListView> {
    return this.call(
      this.http.patch<ListView>(
        this.url(slug, 'participants/me'),
        { displayName },
        { headers: auth(token) },
      ),
    );
  }

  leave(slug: string, token: string): Promise<void> {
    return this.call(
      this.http.delete<void>(this.url(slug, 'participants/me'), { headers: auth(token) }),
    );
  }

  removeParticipant(slug: string, token: string, participantId: number): Promise<ListView> {
    return this.call(
      this.http.delete<ListView>(this.url(slug, `participants/${participantId}`), {
        headers: auth(token),
      }),
    );
  }

  setClaim(slug: string, token: string, itemId: number, quantity: number): Promise<ListView> {
    return this.call(
      this.http.put<ListView>(
        this.url(slug, `items/${itemId}/claim`),
        { quantity },
        { headers: auth(token) },
      ),
    );
  }

  updateList(slug: string, token: string, request: UpdateListRequest): Promise<ListView> {
    return this.call(this.http.put<ListView>(this.url(slug), request, { headers: auth(token) }));
  }

  deleteList(slug: string, token: string): Promise<void> {
    return this.call(this.http.delete<void>(this.url(slug), { headers: auth(token) }));
  }

  addItem(slug: string, token: string, item: ItemInput): Promise<ListView> {
    return this.call(
      this.http.post<ListView>(this.url(slug, 'items'), item, { headers: auth(token) }),
    );
  }

  updateItem(slug: string, token: string, itemId: number, item: ItemInput): Promise<ListView> {
    return this.call(
      this.http.put<ListView>(this.url(slug, `items/${itemId}`), item, { headers: auth(token) }),
    );
  }

  removeItem(slug: string, token: string, itemId: number): Promise<ListView> {
    return this.call(
      this.http.delete<ListView>(this.url(slug, `items/${itemId}`), { headers: auth(token) }),
    );
  }

  reorderItems(slug: string, token: string, itemIds: number[]): Promise<ListView> {
    return this.call(
      this.http.put<ListView>(this.url(slug, 'item-order'), { itemIds }, { headers: auth(token) }),
    );
  }

  /** URL of the Server-Sent Events stream that announces new revisions. */
  eventsUrl(slug: string): string {
    return this.url(slug, 'events');
  }

  private url(slug: string, path?: string): string {
    const base = `${BASE}/${encodeURIComponent(slug)}`;
    return path ? `${base}/${path}` : base;
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.from(error);
    }
  }
}

function auth(token: string | null): HttpHeaders {
  return token ? new HttpHeaders({ [TOKEN_HEADER]: token }) : new HttpHeaders();
}
