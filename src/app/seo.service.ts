import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from './environment';

export interface PageSeo {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}

const DEFAULT_IMAGE = '/fb_cover_agamipatha.png';

const ROUTE_SEO: { match: RegExp | string; seo: PageSeo }[] = [
  {
    match: /^\/$/,
    seo: {
      title: 'AgamiPatha | Self-serve career guide for students & professionals',
      description:
        'AgamiPatha (also written Agami Patha) is a self-serve career guide for students and professionals in India. Map paths from Class 10, 12th, or a degree to a profession — exams, years, and cost, no counsellor booking.',
      path: '/',
    },
  },
  {
    match: /^\/careers$/,
    seo: {
      title: 'Self-serve career guide India | Students & professionals — AgamiPatha',
      description:
        'Use AgamiPatha (Agami Patha) as a self-serve career guide: stream after 10th, careers after 12th, graduation routes, and career switches for working professionals — with exams and cost.',
      path: '/careers',
    },
  },
  {
    match: /^\/why$/,
    seo: {
      title: 'Why AgamiPatha? | Self-serve career guide for students & professionals',
      description:
        'Why AgamiPatha (Agami Patha): a self-serve Indian career guide that starts from your qualification, shows exams and cost, and works for students, professionals, and parents.',
      path: '/why',
    },
  },
  {
    match: /^\/about$/,
    seo: {
      title: 'About AgamiPatha | Self-serve career guide by Coolest Brains',
      description:
        'About AgamiPatha (also written Agami Patha): a self-serve career guide for students and professionals mapping Indian education and career routes.',
      path: '/about',
    },
  },
  {
    match: /^\/circle$/,
    seo: {
      title: 'Path Circle | Meet peers on your career path — AgamiPatha',
      description:
        'Join Path Circle on AgamiPatha: meet students and professionals aiming at the same career. Request–accept privacy — contact only after both accept.',
      path: '/circle',
    },
  },
  {
    match: /^\/report$/,
    seo: {
      title: 'AI career report PDF | AgamiPatha Path Circle',
      description:
        'Generate a personalised AI career report for your AgamiPatha route — catalogue facts plus narrative, risks, and 30/90-day actions. Included with Path Circle mentors.',
      path: '/report',
    },
  },
  {
    match: /^\/store$/,
    seo: {
      title: 'Career guide ebooks & stream chooser | AgamiPatha Store',
      description:
        'Free AgamiPatha career ebooks: Career Path Planner, Class 10 Stream Chooser, All Career Paths, and first-year college guides.',
      path: '/store',
    },
  },
  {
    match: /^\/trending$/,
    seo: {
      title: 'Trending careers for students & professionals | AgamiPatha',
      description:
        'See trending professions and qualifications on AgamiPatha, then open a self-serve career path from your standing.',
      path: '/trending',
    },
  },
  {
    match: /^\/privacy$/,
    seo: {
      title: 'Privacy | AgamiPatha',
      description: 'How AgamiPatha uses account and purchase details.',
      path: '/privacy',
    },
  },
  {
    match: /^\/path$/,
    seo: {
      title: 'Your self-serve career path | AgamiPatha',
      description:
        'A mapped Indian career route on AgamiPatha — qualifications, exams, years, and typical cost from where you stand.',
      path: '/path',
    },
  },
  {
    match: /^\/options$/,
    seo: {
      title: 'Career options from your standing | AgamiPatha',
      description:
        'Browse professions reachable from your Class 10, 12th stream, degree, or professional standing on AgamiPatha.',
      path: '/options',
    },
  },
  {
    match: /^\/compare$/,
    seo: {
      title: 'Compare career paths | AgamiPatha self-serve guide',
      description:
        'Compare two Indian career routes side by side — exams, years, and fit — in this self-serve career guide.',
      path: '/compare',
    },
  },
  {
    match: /^\/admin/,
    seo: {
      title: 'Admin | AgamiPatha',
      description: 'AgamiPatha admin',
      noIndex: true,
    },
  },
  {
    match: /^\/my-/,
    seo: {
      title: 'My account | AgamiPatha',
      description: 'Your AgamiPatha account paths and orders.',
      noIndex: true,
    },
  },
];

const FALLBACK: PageSeo = {
  title: 'AgamiPatha | Self-serve career guide for students & professionals',
  description:
    'AgamiPatha is a self-serve career guide for students and professionals in India — map paths from where you stand to a profession.',
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly siteUrl = environment.siteUrl.replace(/\/$/, '');

  start(): void {
    this.applyForUrl(this.router.url);
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.applyForUrl(e.urlAfterRedirects);
    });
  }

  apply(seo: PageSeo): void {
    const path = seo.path ?? this.currentPath();
    const url = `${this.siteUrl}${path === '/' ? '/' : path}`;
    const image = this.absoluteUrl(seo.image || DEFAULT_IMAGE);
    const robots = seo.noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';

    this.title.setTitle(seo.title);
    this.setMeta('name', 'description', seo.description);
    this.setMeta('name', 'robots', robots);
    this.setMeta('name', 'author', 'AgamiPatha');
    this.setMeta('name', 'application-name', 'AgamiPatha');
    this.setLink('canonical', url);

    this.setMeta('property', 'og:type', 'website');
    this.setMeta('property', 'og:site_name', 'AgamiPatha');
    this.setMeta('property', 'og:locale', 'en_IN');
    this.setMeta('property', 'og:title', seo.title);
    this.setMeta('property', 'og:description', seo.description);
    this.setMeta('property', 'og:url', url);
    this.setMeta('property', 'og:image', image);
    this.setMeta('property', 'og:image:alt', 'AgamiPatha — Your Path to the Future');

    this.setMeta('name', 'twitter:card', 'summary_large_image');
    this.setMeta('name', 'twitter:title', seo.title);
    this.setMeta('name', 'twitter:description', seo.description);
    this.setMeta('name', 'twitter:image', image);
  }

  private applyForUrl(rawUrl: string): void {
    const path = rawUrl.split('?')[0].split('#')[0] || '/';
    const hit = ROUTE_SEO.find((row) =>
      typeof row.match === 'string' ? row.match === path : row.match.test(path),
    );
    this.apply({ ...(hit?.seo ?? FALLBACK), path: hit?.seo.path ?? path });
  }

  private currentPath(): string {
    return this.router.url.split('?')[0].split('#')[0] || '/';
  }

  private absoluteUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    return `${this.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private setMeta(attr: 'name' | 'property', key: string, content: string): void {
    const selector = `${attr}="${key}"`;
    if (this.meta.getTag(selector)) {
      this.meta.updateTag({ [attr]: key, content });
    } else {
      this.meta.addTag({ [attr]: key, content });
    }
  }

  private setLink(rel: string, href: string): void {
    let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}
