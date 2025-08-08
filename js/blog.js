// Import the marked library for Markdown parsing
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

// Blog post data structure
const blogPosts = [
    {
        id: 1,
        title: "Moderní pronájem v roce 2025: Jak na to?",
        slug: "moderni-pronajem-2025",
        date: "2025-02-16",
        excerpt: "Objevte nejnovější trendy a postupy v oblasti pronájmu nemovitostí pro rok 2025. Od digitalizace až po smart home řešení.",
        content: `./blog/posts/moderni-pronajem-2025.md`
    },
    {
        id: 2,
        title: "Jak správně postupovat při neplacení nájmu",
        slug: "jak-spravne-postupovat-pri-neplaceni-najmu",
        date: "2024-02-16",
        excerpt: "Zjistěte, jaké kroky můžete podniknout, když nájemník neplatí nájem, a jak správně postupovat v souladu se zákonem.",
        content: `./blog/posts/neplaceni-najmu.md`
    },
    {
        id: 3,
        title: "Právní nástroje pro řešení problémů s nájemníky",
        slug: "pravni-nastroje-pro-reseni-problemu",
        date: "2024-02-15",
        excerpt: "Přehled právních nástrojů, které můžete využít při řešení problémů s problémovými nájemníky.",
        content: `./blog/posts/pravni-nastroje.md`
    }
];

// Function to load and render blog posts
async function loadBlogPosts() {
    const blogContainer = document.getElementById('blog-posts');
    if (!blogContainer) return;

    const posts = blogPosts.map(post => `
        <article class="fade-in-up bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div class="p-6">
                <div class="flex items-center text-sm text-gray-500 mb-4">
                    <time datetime="${post.date}">${new Date(post.date).toLocaleDateString('cs-CZ', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</time>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-2">
                    <a href="${post.slug}.html" class="hover:text-gray-600 transition-colors duration-200">
                        ${post.title}
                    </a>
                </h3>
                <p class="text-gray-600 mb-4">${post.excerpt}</p>
                <a href="${post.slug}.html" 
                   class="inline-flex items-center text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors duration-200">
                    Číst více
                    <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </a>
            </div>
        </article>
    `).join('');

    blogContainer.innerHTML = posts;
}

// Function to load and render a single blog post
async function loadBlogPost(slug) {
    const post = blogPosts.find(p => p.slug === slug);
    if (!post) return;

    const postContainer = document.getElementById('blog-post');
    if (!postContainer) return;

    try {
        const response = await fetch(post.content);
        const markdown = await response.text();
        const content = marked(markdown);

        postContainer.innerHTML = `
            <article class="prose prose-lg mx-auto">
                <header class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900 mb-4">${post.title}</h1>
                    <time datetime="${post.date}" class="text-gray-500">${new Date(post.date).toLocaleDateString('cs-CZ', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}</time>
                </header>
                ${content}
            </article>
        `;
    } catch (error) {
        console.error('Error loading blog post:', error);
        postContainer.innerHTML = '<p>Nepodařilo se načíst článek.</p>';
    }
}

// Initialize blog functionality
function initBlog() {
    // Check if we're on the blog listing page
    if (document.getElementById('blog-posts')) {
        loadBlogPosts();
    }
    
    // Check if we're on a single blog post page
    if (document.getElementById('blog-post')) {
        const slug = window.location.pathname.split('/').pop();
        loadBlogPost(slug);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initBlog);
