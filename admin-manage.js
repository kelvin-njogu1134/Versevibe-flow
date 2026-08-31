const SUPABASE_URL = 'https://lzfdrgrdaglbsafvujcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmRyZ3JkYWdsYnNhZnZ1amNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDIwNTIsImV4cCI6MjEwMzU3ODA1Mn0.ApBYgdQoswu9BAkUUNku2qgnfcm4tEkucd1rEuTLC8o';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getFileNameFromUrl(url) {
  const parts = url.split('/images/');
  return parts.length > 1 ? parts[1] : null;
}

const fullStoryTextarea = document.getElementById('fullStory');
if (fullStoryTextarea) {
  fullStoryTextarea.addEventListener('input', () => {
    fullStoryTextarea.style.height = 'auto';
    fullStoryTextarea.style.height = fullStoryTextarea.scrollHeight + 'px';
  });
}

async function loadStoriesForManage() {
  const container = document.getElementById('storiesManageList');
  if (!container) return;
  container.innerHTML = 'Loading stories...';

  const { data: stories, error } = await supabaseClient
    .from('stories')
    .select('*')
    .order('created_at', { ascending: false });

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
    div.className = 'story-manage-item';
    div.dataset.id = story.id;

    let imageHtml = '';
    if (story.image_urls && story.image_urls.length > 0) {
      imageHtml = `<img src="${story.image_urls[0]}" alt="cover">`;
    }

    div.innerHTML = `
      <div>
        ${imageHtml}
        <div class="story-info">
          <strong>${story.title}</strong>
          <small>${story.category || 'Uncategorized'} · ${formatDate(story.created_at)}</small>
        </div>
        <div class="story-actions">
          <button class="edit-btn" data-id="${story.id}">Edit</button>
          <button class="delete-btn" data-id="${story.id}">Delete</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => populateEditForm(btn.dataset.id));
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteStory(btn.dataset.id));
  });
}

async function populateEditForm(storyId) {
  const form = document.getElementById('editStoryForm');
  const messageDiv = document.getElementById('editMessage');
  if (!form) return;

  const { data: story, error } = await supabaseClient
    .from('stories')
    .select('*')
    .eq('id', storyId)
    .single();

  if (error || !story) {
    if (messageDiv) {
      messageDiv.style.color = 'red';
      messageDiv.textContent = 'Error loading story: ' + (error?.message || 'Not found');
    }
    return;
  }

  form.dataset.storyId = story.id;
  form.dataset.currentImageUrl = story.image_urls?.[0] || '';

  document.getElementById('editCategory').value = story.category || '';
  document.getElementById('editTitle').value = story.title || '';
  document.getElementById('editShortDesc').value = story.short_description || '';
  const fullStoryField = document.getElementById('editFullStory');
  if (fullStoryField) {
    fullStoryField.value = story.full_story || '';
    fullStoryField.style.height = 'auto';
    fullStoryField.style.height = fullStoryField.scrollHeight + 'px';
  }

  const previewDiv = document.getElementById('currentImagePreview');
  if (previewDiv) {
    if (story.image_urls && story.image_urls.length > 0) {
      previewDiv.innerHTML = `<img src="${story.image_urls[0]}" alt="Current image"><p>Current image</p>`;
    } else {
      previewDiv.innerHTML = '<p>No image</p>';
    }
  }

  if (messageDiv) messageDiv.textContent = '';
  form.scrollIntoView({ behavior: 'smooth' });
}

async function updateStory(e) {
  e.preventDefault();

  const form = document.getElementById('editStoryForm');
  const storyId = form.dataset.storyId;
  const currentImageUrl = form.dataset.currentImageUrl;
  const messageDiv = document.getElementById('editMessage');

  if (!storyId) {
    messageDiv.style.color = 'red';
    messageDiv.textContent = 'No story selected.';
    return;
  }

  const category = document.getElementById('editCategory').value;
  const title = document.getElementById('editTitle').value.trim();
  const shortDesc = document.getElementById('editShortDesc').value.trim();
  const fullStory = document.getElementById('editFullStory').value.trim();
  const fileInput = document.getElementById('editStoryImage');
  const newFile = fileInput.files[0];

  messageDiv.style.color = 'inherit';
  messageDiv.textContent = 'Updating story...';

  try {
    let imageUrls = currentImageUrl ? [currentImageUrl] : [];

    if (newFile) {
      const newFileName = `${Date.now()}-${newFile.name}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('images')
        .upload(newFileName, newFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseClient.storage.from('images').getPublicUrl(newFileName);
      imageUrls = [urlData.publicUrl];

      if (currentImageUrl) {
        const oldFileName = getFileNameFromUrl(currentImageUrl);
        if (oldFileName) {
          await supabaseClient.storage.from('images').remove([oldFileName]);
        }
      }
    }

    const { error: updateError } = await supabaseClient
      .from('stories')
      .update({
        category,
        title,
        short_description: shortDesc,
        full_story: fullStory,
        image_urls: imageUrls,
      })
      .eq('id', storyId);

    if (updateError) throw updateError;

    messageDiv.style.color = 'green';
    messageDiv.textContent = 'Story updated successfully!';

    fileInput.value = '';

    await loadStoriesForManage();
    await populateEditForm(storyId);
  } catch (err) {
    console.error(err);
    messageDiv.style.color = 'red';
    messageDiv.textContent = 'Error updating story: ' + err.message;
  }
}

async function deleteStory(storyId) {
  if (!confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
    return;
  }

  const { data: story, error: fetchError } = await supabaseClient
    .from('stories')
    .select('image_urls')
    .eq('id', storyId)
    .single();

  if (fetchError) {
    alert('Error fetching story: ' + fetchError.message);
    return;
  }

  try {
    const { error: deleteError } = await supabaseClient
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (deleteError) throw deleteError;

    if (story.image_urls && story.image_urls.length > 0) {
      const imageUrl = story.image_urls[0];
      const fileName = getFileNameFromUrl(imageUrl);
      if (fileName) {
        await supabaseClient.storage.from('images').remove([fileName]);
      }
    }

    alert('Story deleted successfully.');
    await loadStoriesForManage();

    const form = document.getElementById('editStoryForm');
    if (form.dataset.storyId === storyId) {
      form.reset();
      form.dataset.storyId = '';
      form.dataset.currentImageUrl = '';
      document.getElementById('currentImagePreview').innerHTML = '';
    }
  } catch (err) {
    console.error(err);
    alert('Error deleting story: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadStoriesForManage();

  const editForm = document.getElementById('editStoryForm');
  if (editForm) {
    editForm.addEventListener('submit', updateStory);
  }

  const cancelBtn = document.getElementById('cancelEdit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      editForm.reset();
      editForm.dataset.storyId = '';
      editForm.dataset.currentImageUrl = '';
      document.getElementById('currentImagePreview').innerHTML = '';
      document.getElementById('editMessage').textContent = '';
    });
  }
});