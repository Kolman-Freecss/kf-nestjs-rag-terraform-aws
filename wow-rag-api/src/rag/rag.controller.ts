import { Body, Controller, Post } from '@nestjs/common';
import { RagService } from './rag.service';
import { QueryDto } from './interfaces/query.dto';
import { AddDocumentDto } from './interfaces/add-document.dto';

/**
 * Controller for RAG (Retrieval Augmented Generation) operations
 */
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  /**
   * Query the RAG system with a question
   */
  @Post('query')
  async query(@Body() dto: QueryDto) {
    const answer = await this.ragService.query(dto.question);
    return { question: dto.question, answer };
  }

  /**
   * Debug endpoint: See what documents are retrieved without generating answer
   */
  @Post('debug')
  async debug(@Body() dto: QueryDto) {
    return await this.ragService.debugQuery(dto.question);
  }

  /**
   * Get all documents in the vector store
   */
  @Post('documents/all')
  async getAllDocuments() {
    return await this.ragService.getAllDocuments();
  }

  /**
   * Add a custom document to the knowledge base
   */
  @Post('documents')
  async addDocument(@Body() dto: AddDocumentDto) {
    await this.ragService.addDocument(dto.content, dto.metadata);
    return { message: 'Document added successfully' };
  }
}
