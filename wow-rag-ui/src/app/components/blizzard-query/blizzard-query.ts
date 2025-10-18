import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Blizzard, RealmResponse } from '../../services/blizzard';

@Component({
  selector: 'app-blizzard-query',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './blizzard-query.html',
  styleUrl: './blizzard-query.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlizzardQuery {
  // State signals
  readonly realmSlug = signal('');
  readonly realmData = signal<RealmResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  // Computed signals
  readonly isRealmEmpty = computed(() => this.realmSlug().trim().length === 0);
  readonly hasRealmData = computed(() => this.realmData() !== null);
  readonly hasError = computed(() => this.error().length > 0);
  readonly normalizedRealmSlug = computed(() =>
    this.realmSlug().toLowerCase().replace(/\s+/g, '-')
  );

  constructor(private readonly blizzardService: Blizzard) {}

  searchRealm(): void {
    if (this.isRealmEmpty()) {
      this.error.set('Please enter a realm name');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.realmData.set(null);

    this.blizzardService.getRealmInfo(this.normalizedRealmSlug()).subscribe({
      next: (data) => {
        this.realmData.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error fetching realm data');
        this.loading.set(false);
      }
    });
  }
}
