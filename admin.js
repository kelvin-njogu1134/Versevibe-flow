const fullStoryTextarea = document.getElementById('fullStory');

// Function to auto-resize
fullStoryTextarea.addEventListener('input', () => {
  fullStoryTextarea.style.height = 'auto';          // reset height
  fullStoryTextarea.style.height = fullStoryTextarea.scrollHeight + 'px'; // adjust to content
});


const SUPABASE_URL = 'https://yyebyrmgqaoiypwcchii.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_PNOBDTlx2p9nIR04E7ZfOw_9dXN_AI6'; 

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    
    function formatDate(isoString) {
      if (!isoString) return '';
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    
    async function loadGallery() {
      const { data: files, error } = await supabaseClient.storage.from('images').list();
      const gallery = document.getElementById('gallery');
      gallery.innerHTML = '';
      if (error) { gallery.innerHTML = '<p class="error">Failed to load images</p>'; return; }
      if (!files || files.length === 0) { gallery.innerHTML = '<p>No images yet.</p>'; return; }

      files.forEach(file => {
        const { publicURL } = supabaseClient.storage.from('images').getPublicUrl(file.name);
        const img = document.createElement('img');
        img.src = publicURL;
        img.alt = file.name;
        gallery.appendChild(img);
      });
    }

    
    async function loadStories() {
      const container = document.getElementById('storiesList');
      container.innerHTML = 'Loading stories...';

      const { data: stories, error } = await supabaseClient
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        container.innerHTML = `<p class="error">Error loading stories: ${error.message}</p>`;
        return;
      }

      if (!stories || stories.length === 0) {
        container.innerHTML = '<p>No stories yet.</p>';
        return;
      }

      container.innerHTML = '';
      stories.forEach(story => {
        const div = document.createElement('div');
        div.className = 'story-item';

        
        let imgHtml = '';
        if (story.image_urls && story.image_urls.length > 0) {
          imgHtml = `<img src="${story.image_urls[0]}" alt="cover" style="max-width:100%; max-height:150px;">`;
        }

        div.innerHTML = `
          <h3>${story.title}</h3>
          <p><strong>Category:</strong> ${story.category}</p>
          <p><strong>Date:</strong> ${formatDate(story.created_at)}</p>
          ${imgHtml}
          <p><strong>Short description:</strong> ${story.short_description}</p>
          <details>
            <summary>Read full story</summary>
            <p>${story.full_story.replace(/\n/g, '<br>')}</p>
          </details>
          <hr style="margin:10px 0;">
        `;
        container.appendChild(div);
      });
    }

    
    loadGallery();
    loadStories();

    
    const storyForm = document.getElementById('storyForm');
    const storyMessage = document.getElementById('storyMessage');

    storyForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const category = document.getElementById('category').value;
      const title = document.getElementById('title').value.trim();
      const shortDesc = document.getElementById('shortDesc').value.trim();
      const fullStory = document.getElementById('fullStory').value.trim();
      const fileInput = document.getElementById('storyImage');
      const file = fileInput.files[0];

      if (!file) { alert("Please select an image"); return; }
      storyMessage.style.color = 'black';
      storyMessage.textContent = 'Uploading story...';

      try {
        
        const fileName = `${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabaseClient.storage.from('images').upload(fileName, file);
        if (uploadError) throw uploadError;

        const { publicURL } = supabaseClient.storage.from('images').getPublicUrl(fileName);

        
        const { data, error } = await supabaseClient.from('stories').insert([
          { 
            category, 
            title, 
            short_description: shortDesc, 
            full_story: fullStory, 
            image_urls: [publicURL] 
          }
        ]);
        if (error) throw error;

        storyMessage.style.color = 'green';
        storyMessage.textContent = 'Story added successfully!';
        storyForm.reset();
        
        loadGallery();
        loadStories();
      } catch (err) {
        console.error(err);
        storyMessage.style.color = 'red';
        storyMessage.textContent = 'Error adding story: ' + err.message;
      }
    });