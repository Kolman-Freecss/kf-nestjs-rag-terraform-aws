import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RagQueryRequest {
  question: string;
}

export interface RagQueryResponse {
  answer: string;
  context: string[];
  blizzardData?: any;
}

export interface DocumentRequest {
  content: string;
  topic: string;
}

@Injectable({
  providedIn: 'root'
})
export class Rag {
  private apiUrl = 'http://localhost:3000/rag';

  constructor(private http: HttpClient) {}

  /**
   * Query the RAG system
   * @param question - The question to ask
   */
  query(question: string): Observable<RagQueryResponse> {
    return this.http.post<RagQueryResponse>(`${this.apiUrl}/query`, { question });
  }

  /**
   * Add a new document to the knowledge base (temporary until restart)
   * @param content - Document content
   * @param topic - Document topic
   */
  addDocument(content: string, topic: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/documents`, { content, topic });
  }
}
