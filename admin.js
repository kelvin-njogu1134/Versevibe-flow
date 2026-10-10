import { supabase } from './supabaseClient.js';

const fullStoryTextarea = document.getElementById('fullStory');
if (fullStoryTextarea) {
  fullStoryTextarea.addEventListener('input', () => {
    fullStoryTextarea.style.height = 'auto';
    fullStoryTextarea.style.height = fullStoryTextarea.scrollHeight + 'px';
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

    if (!title) {
      alert('Please enter a title');
      return;
    }
    if (!file) {
      alert('Please select an image');
      return;
    }

    storyMessage.style.color = 'inherit';
    storyMessage.textContent = 'Uploading story...';

    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('stories')
        .insert([{
          category,
          title,
          short_description: shortDesc,
          full_story: fullStory,
          image_urls: [publicUrlData.publicUrl]
        }]);
      if (insertError) throw insertError;

      storyMessage.style.color = 'green';
      storyMessage.textContent = 'Story added successfully!';
      storyForm.reset();
    } catch (err) {
      console.error(err);
      storyMessage.style.color = 'red';
      storyMessage.textContent = 'Error adding story: ' + err.message;
    }
  });
}