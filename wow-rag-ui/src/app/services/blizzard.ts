import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RealmResponse {
  id: number;
  name: string;
  slug: string;
  region?: {
    name: string;
    id: number;
  };
  category?: string;
  locale?: string;
  timezone?: string;
  type?: {
    type: string;
    name: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class Blizzard {
  private apiUrl = 'http://localhost:3000/blizzard';

  constructor(private http: HttpClient) {}

  /**
   * Get realm information by slug
   * @param realmSlug - The realm slug (e.g., "area-52")
   */
  getRealmInfo(realmSlug: string): Observable<RealmResponse> {
    return this.http.get<RealmResponse>(`${this.apiUrl}/realm/${realmSlug}`);
  }
}
