import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lzfdrgrdaglbsafvujcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmRyZ3JkYWdsYnNhZnZ1amNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDIwNTIsImV4cCI6MjEwMzU3ODA1Mn0.ApBYgdQoswu9BAkUUNku2qgnfcm4tEkucd1rEuTLC8o';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

    if (!file) {
      alert('Please select an image');
      return;
    }

    storyMessage.style.color = 'inherit';
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
    } catch (err) {
      console.error(err);
      storyMessage.style.color = 'red';
      storyMessage.textContent = 'Error adding story: ' + err.message;
    }
  });
}