import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./page/intro/intro.component').then(m => m.IntroPage)   // default landing
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./page/map/map.page').then(m => m.MapPage)         // your existing map
  },
  { path: '**', redirectTo: '' }
];
