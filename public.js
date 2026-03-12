// ========== CONFIGURATION ==========
    
    const SUPABASE_URL = 'https://yyebyrmgqaoiypwcchii.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_PNOBDTlx2p9nIR04E7ZfOw_9dXN_AI6'; 

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // format date
    function formatDate(isoString) {
      if (!isoString) return '';
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });
    }

    // Fetch stories – optionally filtered by category
    async function fetchStories(category = '') {
      console.log('Fetching stories. Category filter:', category || 'ALL');
      
      let query = supabaseClient
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If a specific category is selected (not empty), add filter
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

    // Render stories with debug info
    async function displayStories(category = '') {
      const container = document.getElementById('storiesContainer');
      container.innerHTML = `<div class="loader">
    <span class="loader-text">loading</span>
      <span class="load"></span>
  </div>`

      const { error, data: stories } = await fetchStories(category);

      // Error handling
      if (error) {
        let userMessage = error.message;
        if (error.message.includes('JWT') || error.message.includes('apikey') || error.message.includes('401')) {
          userMessage = 'Invalid Supabase anon key. Please check your configuration.';
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
          userMessage = 'The "stories" table does not exist. Please create it in your Supabase database.';
        } else if (error.message.includes('permission denied')) {
          userMessage = 'Permission denied. Add a SELECT policy for the "stories" table.';
        }
        container.innerHTML = `<div class="error-message">❌ ${userMessage}</div>`;
        return;
      }

      // No stories
      if (!stories || stories.length === 0) {
        container.innerHTML = '<div class="empty-message">✨ No stories yet. Be the first to share!</div>';
        return;
      }

      // Render each story with debug logs
      container.innerHTML = '';
      stories.forEach((story, index) => {
        console.log(`Story ${index}:`, story);
        console.log('image_urls:', story.image_urls);

        const article = document.createElement('article');
        article.className = 'story';

        // Cover image handling with fallback
        let coverHtml = '';
        if (story.image_urls && Array.isArray(story.image_urls) && story.image_urls.length > 0) {
          const imgUrl = story.image_urls[0];
          console.log('First image URL:', imgUrl);
          coverHtml = `<img src="${imgUrl}" alt="${story.title}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/600x400?text=Image+not+found';">`;
        } else if (story.image_url) {
          console.log('Legacy image_url:', story.image_url);
          coverHtml = `<img src="${story.image_url}" alt="${story.title}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/600x400?text=Image+not+found';">`;
        } else {
          console.warn('No image found for story:', story.title);
          coverHtml = '<div style="background:#eee; padding:2rem; text-align:center; border-radius:24px;">📷 No image available</div>';
        }

        const dateStr = formatDate(story.created_at);

        article.innerHTML = `
  ${coverHtml}

  <div class="story-content">
      <div class="meta"> Date: ${dateStr}</div>
      <h2> Title: ${story.title}</h2>
        <div class="short-desc"> Description: ${story.short_description}</div>
      <div class="full-story"> Full Story: ${story.full_story.replace(/\n/g, '<br>')}</div>
  </div>
`;

        container.appendChild(article);
      });
    }

    // Event listener: when dropdown changes, reload stories
    document.getElementById('categorySelect').addEventListener('change', (e) => {
      displayStories(e.target.value);
    });

    // On page load, show all stories
    window.addEventListener('load', () => {
      displayStories('');
    });