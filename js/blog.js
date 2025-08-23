// Markdown parser will be lazy-loaded only on post pages to avoid breaking the listing page
let _marked = null;

// Blog post data structure (6 posts)
const blogPosts = [
  {
    id: 1,
    title: 'Jak zvýšit hodnotu svého bytu pro pronájem',
    slug: 'jak-zvysit-hodnotu-sveho-bytu',
    date: '2025-03-15',
    readTime: '5 min čtení',
    category: 'Praktické tipy',
    image: '../images/blog/clanek1.png',
    excerpt: 'Maximalizujte výnos z pronájmu svého bytu pomocí chytrých a cenově dostupných vylepšení...',
    content: 'posts/jak-zvysit-hodnotu-sveho-bytu.md'
  },
  {
    id: 2,
    title: 'Nájemní smlouva bez starostí: Jak se vyhnout zbytečným problémům?',
    slug: 'pravni-aspekty-najemni-smlouvy',
    date: '2025-08-23',
    readTime: '7 min čtení',
    category: 'Právní rady',
    image: '../images/blog/clanek2.png',
    excerpt: 'Nájemní smlouva je klíčovým dokumentem, který definuje vztah mezi pronajímatelem a nájemcem...',
    content: 'posts/pravni-aspekty-najemni-smlouvy.md'
  },
  {
    id: 3,
    title: 'Analýza trhu s nájemním bydlením v roce 2025: Co je potřeba vědět?',
    slug: 'vyvoj-cen-najmu-2025',
    date: '2025-08-23',
    readTime: '6 min čtení',
    category: 'Vývoj cen',
    image: '../images/blog/clanek3.png',
    excerpt: 'Sledujeme aktuální trendy v cenách nájemného a přinášíme vám podrobnou analýzu vývoje trhu...',
    content: 'posts/vyvoj-cen-najmu-2025.md'
  },
  {
    id: 4,
    title: 'Jak řešit problémy s nájemníkem: Praktický průvodce',
    slug: 'jak-resit-problemy-s-najemnikem',
    date: '2025-08-23',
    readTime: '8 min čtení',
    category: 'Praktické tipy',
    image: '../images/blog/clanek4.png',
    excerpt: 'Problémy s nájemníky patří mezi největší obavy majitelů. V tomto článku vám poradíme...',
    content: 'posts/jak-resit-problemy-s-najemnikem.md'
  },
  {
    id: 5,
    title: 'Moderní pronájem v roce 2025: Jak na to?',
    slug: 'moderni-pronajem-2025',
    date: '2025-02-28',
    readTime: '6 min čtení',
    category: 'Trendy',
    image: '../images/blog/clanek5.png',
    excerpt: 'Pronajímání nemovitostí prochází významnou transformací. Představíme vám nejnovější trendy...',
    content: 'posts/moderni-pronajem-2025.md'
  },
  {
    id: 6,
    title: 'Co dělat, když nájemník neplatí nájem',
    slug: 'neplaceni-najmu',
    date: '2025-08-23',
    readTime: '5 min čtení',
    category: 'Právní rady',
    image: '../images/blog/clanek6.png',
    excerpt: 'Neplacení nájmu patří mezi nejčastější problémy pronajímatelů. Poradíme vám, jak postupovat...',
    content: 'posts/neplaceni-najmu.md'
  }
  ,
  {
    id: 7,
    title: 'Pronájem bez starostí: 5 důvodů, proč majitelé v roce 2025 přecházejí na garantovaný nájem',
    slug: 'pronajem-bez-starosti-5-duvodu-garantovany-najem-2025',
    date: '2025-08-23',
    readTime: '7 min čtení',
    category: 'Trendy',
    image: '../images/blog/clanek3.png',
    excerpt: 'Proč v roce 2025 stále více majitelů volí garantovaný nájem? Shrnutí hlavních důvodů a přínosů.',
    content: 'posts/pronajem-bez-starosti-5-duvodu-garantovany-najem-2025.md'
  }
];

// Utility
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
}

// Function to load and render blog posts (with optional category filter)
async function loadBlogPosts(category = 'all') {
  const blogContainer = document.getElementById('blog-posts');
  if (!blogContainer) return;

  const filtered = category === 'all' ? blogPosts : blogPosts.filter(p => p.category === category);

  const postsHTML = filtered
    .map(
      (post) => `
        <article class="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-100">
          <a href="post.html?slug=${post.slug}" class="block">
            <img src="${post.image}" alt="Thumbnail" class="w-full h-48 object-cover">
            <div class="p-6">
              <div class="flex items-center gap-2 mb-4">
                <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">${post.category}</span>
                <span class="text-gray-400 text-sm">${post.readTime}</span>
              </div>
              <h3 class="text-xl font-semibold text-gray-900 mb-2">${post.title}</h3>
              <p class="text-gray-600 mb-4">${post.excerpt}</p>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-400">${formatDate(post.date)}</span>
                <span class="text-[#0D28F2] font-medium">Číst více</span>
              </div>
            </div>
          </a>
        </article>`
    )
    .join('');

  blogContainer.innerHTML = postsHTML || '<p class="text-gray-600">Žádné články pro vybranou kategorii.</p>';

  // Update counters if present
  const shownEl = document.getElementById('shown-count');
  const totalEl = document.getElementById('total-count');
  if (shownEl) shownEl.textContent = String(filtered.length);
  if (totalEl) totalEl.textContent = String(blogPosts.length);
}

// Function to load and render a single blog post
function decoratePostContent(slug, html) {
  // Vloží speciální prvky pro konkrétní články (Náš tip, CTA bannery)
  if (slug === 'pronajem-bez-starosti-5-duvodu-garantovany-najem-2025') {
    const tipBox = `
      <div class="not-prose mb-8">
        <div class="flex items-start gap-4 p-5 rounded-2xl border border-blue-100 bg-blue-50/60">
          <div class="shrink-0 w-10 h-10 rounded-full bg-[#0D28F2] text-white flex items-center justify-center font-semibold">i</div>
          <div>
            <div class="inline-flex items-center gap-2 mb-1">
              <span class="px-3 py-1 text-xs font-semibold rounded-full bg-[#0D28F2]/10 text-[#0D28F2] uppercase tracking-wide">Náš tip</span>
            </div>
            <p class="text-gray-700">Chcete jistotu příjmu bez výpadků a starostí? Zvažte garantovaný nájem – my platíme nájem vám, ne nájemníkovi.</p>
          </div>
        </div>
      </div>`;

    const ctaBannerMiddle = `
      <section class="not-prose my-10">
        <div class="rounded-2xl p-6 md:p-8 border border-gray-200 bg-gradient-to-r from-white to-blue-50">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 class="text-xl font-semibold text-gray-900">Pronajímejte bez starostí</h3>
              <p class="text-gray-600">Fixní nájem, právní ochrana, prověření nájemníci a kompletní správa.</p>
            </div>
            <div class="flex gap-3">
              <button type="button" data-open-popup class="inline-flex items-center justify-center px-5 py-3 rounded-full bg-[#0D28F2] text-white hover:bg-[#0a1fc5] transition">Mám zájem →</button>
              <a href="../kalkulator-trzniho-najemneho.html" class="inline-flex items-center justify-center px-5 py-3 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition">Spočítat nájemné</a>
            </div>
          </div>
        </div>
      </section>`;

    const ctaBannerBottom = `
      <section class="not-prose mt-12">
        <div class="bg-gray-900 rounded-2xl text-white p-8 text-center">
          <h3 class="text-2xl font-semibold mb-3">Získejte garanci nájmu již dnes</h3>
          <p class="text-gray-300 mb-6">Bez prázdných měsíců, bez stresu a s plným servisem.</p>
          <div class="flex flex-col sm:flex-row justify-center gap-3">
            <button type="button" data-open-popup class="px-6 py-3 rounded-full bg-white text-gray-900 hover:bg-gray-100 transition">ZÍSKAT GARANCI NÁJMU →</button>
            <a href="../kalkulator.html" class="px-6 py-3 rounded-full border border-white text-white hover:text-gray-900 hover:bg-white transition">Spočítat úsporu</a>
          </div>
        </div>
      </section>`;

    // Vlož tip box na začátek a bannery doprostřed a nakonec
    // Heuristika: vložit střední banner po první H2, pokud existuje
    let modified = tipBox + html;
    const h2Index = modified.indexOf('<h2');
    if (h2Index !== -1) {
      const insertAt = modified.indexOf('</h2>', h2Index);
      if (insertAt !== -1) {
        modified = modified.slice(0, insertAt + 5) + ctaBannerMiddle + modified.slice(insertAt + 5);
      }
    }
    modified += ctaBannerBottom;
    return modified;
  }
  return html;
}

async function loadBlogPost(slug) {
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return;

  const postContainer = document.getElementById('blog-post');
  if (!postContainer) return;

  try {
    const response = await fetch(post.content);
    const markdown = await response.text();
    // Lazy-load markdown parser only when needed
    if (!_marked) {
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js');
        _marked = mod.marked || mod.default || mod;
      } catch (e) {
        console.error('Nepodařilo se načíst parser Markdownu:', e);
        _marked = (x) => x; // graceful fallback: render raw markdown
      }
    }
    let content = (_marked.parse ? _marked.parse(markdown) : _marked(markdown));
    content = decoratePostContent(slug, content);

    postContainer.innerHTML = `
      <article class="prose prose-lg mx-auto">
        <header class="mb-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">${post.category}</span>
            <time datetime="${post.date}" class="text-gray-500">${formatDate(post.date)}</time>
            <span class="text-gray-500 text-sm">•</span>
            <span class="text-gray-500 text-sm">${post.readTime}</span>
          </div>
          <h1 class="text-4xl font-bold text-gray-900">${post.title}</h1>
        </header>

        <figure class="mb-8">
          <img src="${post.image}" alt="Hlavní obrázek článku" class="w-full h-72 md:h-96 object-cover rounded-2xl shadow-sm" />
        </figure>

        <div class="not-prose mb-8 flex flex-col sm:flex-row gap-4">
          <button type="button" data-open-popup class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-full text-white bg-[#0D28F2] hover:bg-[#0a1fc5] transition-all duration-300 shadow-sm hover:shadow-md">
            ZÍSKAT GARANCI NÁJMU →
          </button>
          <a href="../kalkulator-trzniho-najemneho.html" class="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 transition-all duration-300">
            Spočítat nájemné
          </a>
        </div>

        ${content}

        <div class="not-prose mt-10 pt-8 border-t border-gray-200 flex flex-col sm:flex-row gap-4">
          <a href="index.html" class="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 transition-all duration-300">
            ← Zpět na blog
          </a>
          <button type="button" data-open-popup class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-full text-white bg-gray-900 hover:bg-gray-800 transition-all duration-300">
            Mám zájem o službu
          </button>
        </div>
      </article>`;

    // Attach vanilla JS handlers to open popup
    try {
      const openers = postContainer.querySelectorAll('[data-open-popup]');
      openers.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          // Prefer Alpine store if available
          if (window.Alpine && typeof Alpine.store === 'function') {
            try { Alpine.store('popup').open(); } catch (_) {}
          }
          // Dispatch a custom event so any listener can show modal
          window.dispatchEvent(new CustomEvent('open-contact-popup'));
          // Body scroll lock fallback
          document.body.classList.add('overflow-hidden');
        }, { once: false });
      });
    } catch (_) {}
  } catch (error) {
    console.error('Error loading blog post:', error);
    postContainer.innerHTML = '<p>Nepodařilo se načíst článek.</p>';
  }
}

// Initialize blog functionality
function initBlog() {
  // Listing page
  if (document.getElementById('blog-posts')) {
    let currentCategory = 'all';
    loadBlogPosts(currentCategory);

    // Wire category buttons
    const catContainer = document.getElementById('blog-categories');
    const clearBtn = document.getElementById('clear-filters');

    function setActive(category) {
      if (!catContainer) return;
      const buttons = Array.from(catContainer.querySelectorAll('button[data-category]'));
      buttons.forEach(btn => {
        const isActive = btn.getAttribute('data-category') === category;
        btn.classList.toggle('bg-[#0D28F2]', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('hover:bg-[#0a1fc5]', isActive);

        btn.classList.toggle('bg-gray-100', !isActive);
        btn.classList.toggle('text-gray-700', !isActive);
        btn.classList.toggle('hover:bg-gray-200', !isActive);
      });
    }

    if (catContainer) {
      catContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button[data-category]');
        if (!target) return;
        currentCategory = target.getAttribute('data-category') || 'all';
        setActive(currentCategory);
        loadBlogPosts(currentCategory);
      });
      // Ensure initial active is set
      setActive(currentCategory);
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        currentCategory = 'all';
        setActive(currentCategory);
        loadBlogPosts(currentCategory);
      });
    }
  }

  // Single post template page (expects ?slug=...)
  if (document.getElementById('blog-post')) {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (slug) {
      loadBlogPost(slug);
    }
  }
}

// Initialize when DOM is ready (robust for Safari and others)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlog, { once: true });
} else {
  // DOM is already parsed
  initBlog();
}
