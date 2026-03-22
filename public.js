// ========== CONFIGURATION ==========
const SUPABASE_URL = 'https://yyebyrmgqaoiypwcchii.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PNOBDTlx2p9nIR04E7ZfOw_9dXN_AI6'; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== FORMAT DATE ==========
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// ========== FETCH STORIES ==========
async function fetchStories(category = '') {
  let query = supabaseClient
    .from('stories')
    .select('*')
    .order('created_at', { ascending: false });
  if (category) {
    query = query.eq('category', category);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Supabase error:', error);
    return { error, data: null };
  }
  return { error: null, data };
}

// ========== DISPLAY STORIES ==========
async function displayStories(category = '') {
  const container = document.getElementById('storiesContainer');
  container.innerHTML = `
    <div class="loader">
      <span class="loader-text">loading</span>
      <span class="load"></span>
    </div>
  `;
  const { error, data: stories } = await fetchStories(category);
  if (error) {
    container.innerHTML = `<div class="error-message">❌ ${error.message}</div>`;
    return;
  }
  if (!stories || stories.length === 0) {
    container.innerHTML = `<div class="empty-message">✨ No stories yet.</div>`;
    return;
  }
  container.innerHTML = '';

  stories.forEach((story) => {
    const article = document.createElement('article');
    article.className = 'story';

    // ========== IMAGE ==========
    let coverHtml = '';
    if (story.image_urls && Array.isArray(story.image_urls) && story.image_urls.length > 0) {
      coverHtml = `
        <img 
          src="${story.image_urls[0]}" 
          alt="${story.title}" 
          loading="lazy"
          onerror="this.onerror=null;this.src='https://via.placeholder.com/600x400?text=Image+not+found';"
        >
      `;
    } else if (story.image_url) {
      coverHtml = `
        <img 
          src="${story.image_url}" 
          alt="${story.title}" 
          loading="lazy"
        >
      `;
    } else {
      coverHtml = `
        <div style="background:#eee;padding:2rem;text-align:center;border-radius:20px;">
          📷 No image available
        </div>
      `;
    }

    const dateStr = formatDate(story.created_at);
    const preview = story.full_story.substring(0,150);

    // ========== STORY HTML ==========
    article.innerHTML = `
      ${coverHtml}
      <div class="story-content">
        <div class="meta">
          Date: ${dateStr}
        </div>
        <h2>
          Title: ${story.title}
        </h2>
        <div class="short-desc">
          Description: ${story.short_description}
        </div>
        <div class="story-preview">
          Full Story: ${preview}...
        </div>
        <div class="full-story" style="display:none;">
          ${story.full_story.replace(/\n/g,'<br>')}
        </div>
        <button class="read-more-btn">
          Read More
        </button>
      </div>
    `;

    container.appendChild(article);

    // ========== BUTTON FUNCTION ==========
    const btn = article.querySelector('.read-more-btn');
    const fullStory = article.querySelector('.full-story');
    const previewText = article.querySelector('.story-preview');
    const image = article.querySelector('img');

    btn.addEventListener('click', () => {
      if (fullStory.style.display === 'none') {
        fullStory.style.display = 'block';
        previewText.style.display = 'none';
        if(image){
          image.style.display = 'none';
        }
        btn.textContent = 'Read Less';
      } else {
        fullStory.style.display = 'none';
        previewText.style.display = 'block';
        if(image){
          image.style.display = 'block';
        }
        btn.textContent = 'Read More';
      }
    });
  });
}

// ========== CATEGORY FILTER ==========
document.getElementById('categorySelect').addEventListener('change', (e) => {
  displayStories(e.target.value);
});

// ========== LOAD STORIES ==========
window.addEventListener('load', () => {
  displayStories('');
});