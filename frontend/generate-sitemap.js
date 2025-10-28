import { SitemapStream, streamToPromise } from 'sitemap';
import { createWriteStream } from 'fs';

const links = [
  { url: '/', changefreq: 'daily', priority: 1.0 },
];

const sitemap = new SitemapStream({ hostname: 'https://yourdomain.com' });

streamToPromise(sitemap)
  .then((data) => {
    createWriteStream('./public/sitemap.xml').write(data.toString());
  })
  .catch((err) => console.error('❌ Failed to generate sitemap:', err));

links.forEach(link => sitemap.write(link));
sitemap.end();
