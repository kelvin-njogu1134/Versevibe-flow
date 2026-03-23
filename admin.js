
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'


const SUPABASE_URL = 'https://yyebyrmgqaoiypwcchii.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PNOBDTlx2p9nIR04E7ZfOw_9dXN_AI6';


const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



const fullStoryTextarea = document.getElementById('fullStory');
if (fullStoryTextarea) {
  fullStoryTextarea.addEventListener('input', () => {
    fullStoryTextarea.style.height = 'auto';
    fullStoryTextarea.style.height = fullStoryTextarea.scrollHeight + 'px';
  });
}



function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}



async function loadGallery() {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;

  const { data: files, error } = await supabase.storage
    .from('images')
    .list();

  gallery.innerHTML = '';

  if (error) {
    gallery.innerHTML = '<p class="error">Failed to load images</p>';
    return;
  }

  if (!files || files.length === 0) {
    gallery.innerHTML = '<p>No images yet.</p>';
    return;
  }

  files.forEach(file => {
    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(file.name);

    const img = document.createElement('img');
    img.src = data.publicUrl;
    img.alt = file.name;

    gallery.appendChild(img);
  });
}



async function loadStories() {
  const container = document.getElementById('storiesList');
  if (!container) return;

  container.innerHTML = 'Loading stories...';

  const { data: stories, error } = await supabase
    .from('stories')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<p class="error">Error: ${error.message}</p>`;
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
      imgHtml = `<img src="${story.image_urls[0]}" style="max-width:100%; max-height:150px;">`;
    }

    div.innerHTML = `
      <h3>${story.title}</h3>
      <p><strong>Category:</strong> ${story.category}</p>
      <p><strong>Date:</strong> ${formatDate(story.created_at)}</p>
      ${imgHtml}
      <p>${story.short_description}</p>
      <details>
        <summary>Read full story</summary>
        <p>${story.full_story.replace(/\n/g, '<br>')}</p>
      </details>
      <hr>
    `;

    container.appendChild(div);
  });
}



const storyForm = document.getElementById('storyForm');
const storyMessage = document.getElementById('storyMessage');

if (storyForm) {
  storyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const category = document.getElementById('category').value;
    const title = document.getElementById('title').value.trim();
    const shortDesc = document.getElementById('shortDesc').value.trim();
    const fullStory = document.getElementById('fullStory').value.trim();
    const fileInput = document.getElementById('storyImage');
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select an image");
      return;
    }

    storyMessage.style.color = 'black';
    storyMessage.textContent = 'Uploading story...';

    try {
      
      const fileName = `${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      
      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      const publicURL = publicUrlData.publicUrl;

      
      const { error: insertError } = await supabase
        .from('stories')
        .insert([{
          category,
          title,
          short_description: shortDesc,
          full_story: fullStory,
          image_urls: [publicURL]
        }]);

      if (insertError) throw insertError;

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
}



loadStories();
loadGallery();