import { Component, signal, computed, viewChild, effect, ElementRef, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Rag, RagQueryResponse } from '../../services/rag';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { Subscription } from 'rxjs';

// Register SplitText plugin
gsap.registerPlugin(SplitText);

@Component({
  selector: 'app-rag-query',
  standalone: true,
  imports: [FormsModule, JsonPipe],
  templateUrl: './rag-query.html',
  styleUrl: './rag-query.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RagQuery implements OnDestroy {
  // ViewChild signals (Angular 20)
  readonly answerContainer = viewChild<ElementRef>('answerContainer');
  readonly answerText = viewChild<ElementRef>('answerText');
  readonly contextContainer = viewChild<ElementRef>('contextContainer');

  // State signals
  readonly question = signal('');
  readonly response = signal<RagQueryResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  // Subscription management
  private subscription: Subscription | null = null;

  // Computed signals - Memoized reactive values
  // These are better than methods in templates because they only recalculate when dependencies change
  // This avoids performance issues with Angular's change detection cycle
  readonly isQuestionEmpty = computed(() => this.question().trim().length === 0);
  readonly hasResponse = computed(() => this.response() !== null);
  readonly hasError = computed(() => this.error().length > 0);
  readonly hasBlizzardData = computed(() => this.response()?.blizzardData != null);

  constructor(private readonly ragService: Rag) {
    // Effect to trigger animation when response changes
    effect(() => {
      const responseData = this.response();
      if (responseData) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => this.animateResponse(), 0);
      }
    });
  }

  ngOnDestroy(): void {
    this.cancelRequest();
  }

  askQuestion(): void {
    if (this.isQuestionEmpty()) {
      this.error.set('Please enter a question');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.response.set(null);

    this.subscription = this.ragService.query(this.question()).subscribe({
      next: (data) => {
        this.response.set(data);
        this.loading.set(false);
        this.subscription = null;
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error querying RAG system');
        this.loading.set(false);
        this.subscription = null;
      }
    });
  }

  cancelRequest(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.loading.set(false);
  }

  private animateResponse(): void {
    const answer = this.answerContainer();
    const answerTextEl = this.answerText();
    const context = this.contextContainer();

    // Animate the answer container appearance
    if (answer) {
      gsap.fromTo(
        answer.nativeElement,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out'
        }
      );
    }

    // Animate the answer text letter by letter
    if (answerTextEl) {
      const split = new SplitText(answerTextEl.nativeElement, {
        type: 'chars,words',
        charsClass: 'char'
      });

      gsap.fromTo(
        split.chars,
        {
          opacity: 0,
          y: 10,
          rotationX: -90
        },
        {
          opacity: 1,
          y: 0,
          rotationX: 0,
          duration: 0.02,
          stagger: 0.005,
          ease: 'power4',
          delay: 0.3
        }
      );
    }

    // Animate context items
    if (context) {
      gsap.fromTo(
        context.nativeElement.children,
        { opacity: 0, x: -20 },
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power2.out',
          delay: 0.6 // Start sooner after text animation begins
        }
      );
    }
  }
}
