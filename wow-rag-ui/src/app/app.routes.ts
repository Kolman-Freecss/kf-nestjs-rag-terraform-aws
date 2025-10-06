import { Routes } from '@angular/router';
import { BlizzardQuery } from './components/blizzard-query/blizzard-query';
import { RagQuery } from './components/rag-query/rag-query';

export const routes: Routes = [
  { path: '', redirectTo: '/blizzard', pathMatch: 'full' },
  { path: 'blizzard', component: BlizzardQuery },
  { path: 'rag', component: RagQuery }
];
