import { Routes } from '@angular/router';

import { HomePage } from './pages/home/home.page';

export const routes: Routes = [
  { path: '', component: HomePage, title: 'ShareList — make a list, let everyone pick' },
  {
    path: 'new',
    loadComponent: () => import('./pages/create-list/create-list.page').then((m) => m.CreateListPage),
    title: 'New list · ShareList',
  },
  {
    path: 'l/:slug',
    loadComponent: () => import('./pages/list/list.page').then((m) => m.ListPage),
    title: 'List · ShareList',
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage),
    title: 'Not found · ShareList',
  },
];
