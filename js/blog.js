// Markdown parser will be lazy-loaded only on post pages to avoid breaking the listing page
let _marked = null;

// Blog post data structure (with newest first)
const blogPosts = [
  {
    id: 12,
    title: 'Fond oprav a nájemní vztahy: co je dobré vědět',
    slug: 'fond-oprav-a-najemni-vztahy-co-je-dobre-vedet',
    date: '2025-09-25',
    readTime: '5 min čtení',
    category: 'Právní rady',
    image: '../images/blog/clanek53.png',
    excerpt: 'Kdo platí fond oprav, proč nepatří do záloh na služby a jak ho správně zohlednit v nájemném podle § 1180 OZ.',
    content: 'posts/fond-oprav-a-najemni-vztahy-co-je-dobre-vedet.md'
  },
  {
    id: 11,
    title: 'Zálohy na služby při pronájmu bytu: co musí pronajímatel vědět',
    slug: 'zalohy-na-sluzby-pri-pronajmu-bytu-co-musi-pronajimatel-vedet',
    date: '2025-09-12',
    readTime: '6 min čtení',
    category: 'Právní rady',
    image: '../images/blog/clanek52.png',
    excerpt: 'Jak správně nastavit zálohy, vyúčtování a rozúčtování služeb podle zákona č. 67/2013 Sb. a vyhlášky č. 269/2015 Sb.',
    content: 'posts/zalohy-na-sluzby-pri-pronajmu-bytu-co-musi-pronajimatel-vedet.md'
  },
  {
    id: 10,
    title: 'Jak správně nastavit kauci a zálohy na služby: klíč k bezproblémovému pronájmu',
    slug: 'jak-spravne-nastavit-kauci-a-zalohy-na-sluzby',
    date: '2025-09-07',
    readTime: '7 min čtení',
    category: 'Právní rady',
    image: '../images/blog/clanek104.png',
    excerpt: 'Kauce, zálohy a vyúčtování bez chyb: praktický návod s odkazy na § 2254 OZ a zákon č. 67/2013 Sb., abyste předešli sporům a nastavili vše správně.',
    content: 'posts/jak-spravne-nastavit-kauci-a-zalohy-na-sluzby.md'
  },
  {
    id: 9,
    title: 'Jak snížit riziko prázdného bytu: kompletní průvodce pro pronajímatele',
    slug: 'jak-snizit-riziko-prazdneho-bytu',
    date: '2025-09-05',
    readTime: '7 min čtení',
    category: 'Praktické tipy',
    image: '../images/blog/clanek42.png',
    excerpt: 'Prázdný byt je nejdražší. Jak správně nastavit inzerci, cenu i procesy, aby byt nezůstával bez nájemníka a výnos byl stabilní?',
    content: 'posts/jak-snizit-riziko-prazdneho-bytu.md'
  },
  {
    id: 8,
    title: 'Předávací protokol: Nejdůležitější dokument při pronájmu bytu',
    slug: 'predavaci-protokol-pri-pronajmu-bytu',
    date: '2025-08-25',
    readTime: '7 min čtení',
    category: 'Praktické tipy',
    image: '../images/blog/clanek9.png',
    excerpt: 'Proč je předávací protokol klíčovým dokumentem při pronájmu a co musí obsahovat, aby vás chránil.',
    content: 'posts/predavaci-protokol-pri-pronajmu-bytu.md'
  },
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
    date: '2025-04-22',
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
    date: '2025-06-27',
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
    date: '2025-02-01',
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
    date: '2025-08-06',
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
    date: '2025-07-29',
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

// Pagination config
const POSTS_PER_PAGE = 9;

// Function to load and render blog posts (with optional category filter and pagination)
async function loadBlogPosts(category = 'all', page = 1) {
  const blogContainer = document.getElementById('blog-posts');
  if (!blogContainer) return;

  const filtered = category === 'all' ? blogPosts : blogPosts.filter((p) => p.category === category);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / POSTS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * POSTS_PER_PAGE;
  const end = Math.min(start + POSTS_PER_PAGE, totalItems);
  const pageItems = filtered.slice(start, end);

  const postsHTML = pageItems
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
  if (shownEl) shownEl.textContent = String(pageItems.length);
  if (totalEl) totalEl.textContent = String(totalItems);

  // Render pagination controls
  const pagEl = document.getElementById('blog-pagination');
  if (pagEl) {
    if (totalPages <= 1) {
      pagEl.innerHTML = '';
    } else {
      let html = '';
      // Prev
      html += `<button data-page="prev" class="px-3 py-2 rounded-md border text-sm ${safePage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}">Předchozí</button>`;
      // Numbers
      for (let i = 1; i <= totalPages; i++) {
        const active = i === safePage;
        html += `<button data-page="${i}" class="px-3 py-2 rounded-md border text-sm ${active ? 'bg-[#0D28F2] text-white border-[#0D28F2]' : 'hover:bg-gray-50'}">${i}</button>`;
      }
      // Next
      html += `<button data-page="next" class="px-3 py-2 rounded-md border text-sm ${safePage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}">Další</button>`;
      pagEl.innerHTML = html;
    }
  }

  return { totalItems, totalPages, currentPage: safePage };
}

// Function to load and render a single blog post
function decoratePostContent(slug, html) {
  // Vloží speciální prvky pro konkrétní články (Náš tip, CTA bannery)
  if (slug === 'pronajem-bez-starosti-5-duvodu-garantovany-najem-2025') {
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

    // Vlož pouze CTA bannery – bez Náš tip boxu
    // Heuristika: vložit střední banner po první H2, pokud existuje
    let modified = html;
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
    let currentPage = 1;
    const pagEl = document.getElementById('blog-pagination');

    // Initial render
    loadBlogPosts(currentCategory, currentPage).then((meta) => {
      if (meta) currentPage = meta.currentPage;
    });

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
        currentPage = 1; // reset on category change
        loadBlogPosts(currentCategory, currentPage).then((meta) => {
          if (meta) currentPage = meta.currentPage;
        });
      });
      // Ensure initial active is set
      setActive(currentCategory);
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        currentCategory = 'all';
        setActive(currentCategory);
        currentPage = 1;
        loadBlogPosts(currentCategory, currentPage).then((meta) => {
          if (meta) currentPage = meta.currentPage;
        });
      });
    }

    // Pagination click handling (event delegation)
    if (pagEl) {
      pagEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-page]');
        if (!btn) return;
        const val = btn.getAttribute('data-page');
        // Compute next page based on current meta
        loadBlogPosts(currentCategory, currentPage).then((meta) => {
          if (!meta) return;
          let next = currentPage;
          if (val === 'prev') next = Math.max(1, currentPage - 1);
          else if (val === 'next') next = Math.min(meta.totalPages, currentPage + 1);
          else next = Number(val) || 1;
          if (next !== currentPage) {
            currentPage = next;
            loadBlogPosts(currentCategory, currentPage).then((m2) => { if (m2) currentPage = m2.currentPage; });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      });
    }
  }

  // Single post template page (expects ?slug=...)
  if (document.getElementById('blog-post')) {
    const slug = new URLSearchParams(window.location.search).get('slug');
    if (slug) loadBlogPost(slug).then(() => {
      // Bind delegated handler only once to support CTAs inside rendered Markdown
      if (!window.__blogCtaBound) {
        window.__blogCtaBound = true;
        document.addEventListener('click', (e) => {
          const target = e.target.closest('a[href="#kontakt"], [data-open-popup]');
          if (!target) return;
          e.preventDefault();
          try {
            if (window.Alpine && Alpine.store && Alpine.store('popup') && typeof Alpine.store('popup').open === 'function') {
              Alpine.store('popup').open();
              return;
            }
          } catch (_) {}
          // Vanilla fallback: toggle modal with data attribute if present
          const modal = document.querySelector('[data-popup], [data-modal], #kontakt-modal');
          if (modal) {
            modal.classList.add('isOpen', 'open', 'visible');
            modal.style.display = 'block';
          }
        });
      }
    });
  }
}

// Initialize when DOM is ready (robust for Safari and others)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlog, { once: true });
} else {
  // DOM is already parsed
  initBlog();
}
