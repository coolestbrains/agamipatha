import { Routes } from '@angular/router';
import { adminGuard } from './admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'path',
    loadComponent: () => import('./pages/path-page.component').then((m) => m.PathPageComponent),
  },
  {
    path: 'compare',
    loadComponent: () => import('./pages/compare-page.component').then((m) => m.ComparePageComponent),
  },
  {
    path: 'options',
    loadComponent: () => import('./pages/options-page.component').then((m) => m.OptionsPageComponent),
  },
  {
    path: 'circle',
    loadComponent: () => import('./pages/circle-page.component').then((m) => m.CirclePageComponent),
  },
  {
    path: 'report',
    loadComponent: () => import('./pages/report-page.component').then((m) => m.ReportPageComponent),
  },
  {
    path: 'my-paths',
    loadComponent: () => import('./pages/my-paths-page.component').then((m) => m.MyPathsPageComponent),
  },
  {
    path: 'my-orders',
    loadComponent: () =>
      import('./pages/my-orders-page.component').then((m) => m.MyOrdersPageComponent),
  },
  {
    path: 'my-timeline',
    loadComponent: () =>
      import('./pages/my-timeline-page.component').then((m) => m.MyTimelinePageComponent),
  },
  {
    path: 'trending',
    loadComponent: () =>
      import('./pages/trending-page.component').then((m) => m.TrendingPageComponent),
  },
  {
    path: 'store',
    loadComponent: () => import('./pages/store-page.component').then((m) => m.StorePageComponent),
  },
  {
    path: 'careers',
    loadComponent: () => import('./pages/careers-page.component').then((m) => m.CareersPageComponent),
  },
  {
    path: 'why',
    loadComponent: () => import('./pages/why-page.component').then((m) => m.WhyPageComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about-page.component').then((m) => m.AboutPageComponent),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/privacy-page.component').then((m) => m.PrivacyPageComponent),
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/admin-login.component').then((m) => m.AdminLoginComponent),
  },
  { path: 'admin', pathMatch: 'full', redirectTo: 'admin/nodes' },
  {
    path: 'admin/nodes/new',
    loadComponent: () =>
      import('./pages/admin-node-edit.component').then((m) => m.AdminNodeEditComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/nodes/:id',
    loadComponent: () =>
      import('./pages/admin-node-edit.component').then((m) => m.AdminNodeEditComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/nodes',
    loadComponent: () => import('./pages/admin-nodes.component').then((m) => m.AdminNodesComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/edges',
    loadComponent: () => import('./pages/admin-edges.component').then((m) => m.AdminEdgesComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/paths',
    loadComponent: () => import('./pages/admin-paths.component').then((m) => m.AdminPathsComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/suggestions',
    loadComponent: () =>
      import('./pages/admin-suggestions.component').then((m) => m.AdminSuggestionsComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/store',
    loadComponent: () => import('./pages/admin-store.component').then((m) => m.AdminStoreComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'admin/circle',
    loadComponent: () => import('./pages/admin-circle.component').then((m) => m.AdminCircleComponent),
    canActivate: [adminGuard],
  },
  { path: '**', redirectTo: '' },
];
