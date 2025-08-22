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
    title: 'Právní aspekty nájemní smlouvy: Na co si dát pozor',
    slug: 'pravni-aspekty-najemni-smlouvy',
    date: '2025-03-12',
    readTime: '7 min čtení',
    category: 'Právní rady',
    image: '../images/blog/clanek2.png',
    excerpt: 'Nájemní smlouva je klíčovým dokumentem, který definuje vztah mezi pronajímatelem a nájemcem...',
    content: 'posts/pravni-aspekty-najemni-smlouvy.md'
  },
  {
    id: 3,
    title: 'Vývoj cen nájmů v roce 2025: Analýza trhu a předpověď',
    slug: 'vyvoj-cen-najmu-2025',
    date: '2025-03-10',
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
    date: '2025-03-05',
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
    date: '2025-02-20',
    readTime: '5 min čtení',
    category: 'Právní rady',
    image: '../images/blog/clanek6.png',
    excerpt: 'Neplacení nájmu patří mezi nejčastější problémy pronajímatelů. Poradíme vám, jak postupovat...',
    content: 'posts/neplaceni-najmu.md'
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
    const content = (_marked.parse ? _marked.parse(markdown) : _marked(markdown));

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
