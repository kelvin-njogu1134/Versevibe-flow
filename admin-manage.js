
const SUPABASE_URL = 'https://yyebyrmgqaoiypwcchii.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PNOBDTlx2p9nIR04E7ZfOw_9dXN_AI6';

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
      imageHtml = `<img src="${story.image_urls[0]}" alt="cover" style="max-width:80px; max-height:60px; margin-right:10px;">`;
    }

    div.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        ${imageHtml}
        <div style="flex:1;">
          <strong>${story.title}</strong> (${formatDate(story.created_at)})<br>
          <small>Category: ${story.category}</small>
        </div>
        <button class="edit-btn" data-id="${story.id}">Edit</button>
        <button class="delete-btn" data-id="${story.id}">Delete</button>
      </div>
      <hr style="margin:10px 0;">
    `;
    container.appendChild(div);
  });

  // Attach event listeners to edit and delete buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => populateEditForm(btn.dataset.id));
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteStory(btn.dataset.id));
  });
}

// ---------------------------
// 4. Populate the edit form with story data
// ---------------------------
async function populateEditForm(storyId) {
  const form = document.getElementById('editStoryForm');
  const messageDiv = document.getElementById('editMessage');
  if (!form) return;

  // Fetch the story
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

  // Store story id in a hidden field or data attribute
  form.dataset.storyId = story.id;
  form.dataset.currentImageUrl = story.image_urls?.[0] || '';

  // Fill form fields
  document.getElementById('editCategory').value = story.category || '';
  document.getElementById('editTitle').value = story.title || '';
  document.getElementById('editShortDesc').value = story.short_description || '';
  const fullStoryField = document.getElementById('editFullStory');
  if (fullStoryField) {
    fullStoryField.value = story.full_story || '';
    // Trigger auto-resize
    fullStoryField.style.height = 'auto';
    fullStoryField.style.height = fullStoryField.scrollHeight + 'px';
  }

  // Show current image preview if exists
  const previewDiv = document.getElementById('currentImagePreview');
  if (previewDiv) {
    if (story.image_urls && story.image_urls.length > 0) {
      previewDiv.innerHTML = `<img src="${story.image_urls[0]}" alt="Current image" style="max-width:200px; max-height:150px;"><br>
                              <small>Current image</small>`;
    } else {
      previewDiv.innerHTML = '<p>No image</p>';
    }
  }

  // Clear any previous message
  if (messageDiv) messageDiv.textContent = '';

  // Optionally scroll to form
  form.scrollIntoView({ behavior: 'smooth' });
}

// ---------------------------
// 5. Update story (handle text fields and optional image change)
// ---------------------------
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

  // Get form values
  const category = document.getElementById('editCategory').value;
  const title = document.getElementById('editTitle').value.trim();
  const shortDesc = document.getElementById('editShortDesc').value.trim();
  const fullStory = document.getElementById('editFullStory').value.trim();
  const fileInput = document.getElementById('editStoryImage');
  const newFile = fileInput.files[0];

  messageDiv.style.color = 'black';
  messageDiv.textContent = 'Updating story...';

  try {
    let imageUrls = currentImageUrl ? [currentImageUrl] : [];

    // If a new image was selected, upload it and delete the old one
    if (newFile) {
      // 1. Upload new image
      const newFileName = `${Date.now()}-${newFile.name}`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('images')
        .upload(newFileName, newFile);
      if (uploadError) throw uploadError;

      const { publicURL } = supabaseClient.storage.from('images').getPublicUrl(newFileName);
      imageUrls = [publicURL];

      // 2. Delete old image from storage (if exists)
      if (currentImageUrl) {
        const oldFileName = getFileNameFromUrl(currentImageUrl);
        if (oldFileName) {
          await supabaseClient.storage.from('images').remove([oldFileName]);
        }
      }
    }

    // Update the story record
    const { error: updateError } = await supabaseClient
      .from('stories')
      .update({
        category,
        title,
        short_description: shortDesc,
        full_story: fullStory,
        image_urls: imageUrls,
        // updated_at can be added automatically if you have a trigger
      })
      .eq('id', storyId);

    if (updateError) throw updateError;

    messageDiv.style.color = 'green';
    messageDiv.textContent = 'Story updated successfully!';

    // Clear the file input
    fileInput.value = '';

    // Refresh the list and clear the form (optional)
    await loadStoriesForManage();
    // Optionally reset the form or keep data
    // form.reset(); // careful: this would clear all fields, including storyId
    // Instead, keep the updated data in the form
    // You can re-populate with the new data:
    await populateEditForm(storyId);
  } catch (err) {
    console.error(err);
    messageDiv.style.color = 'red';
    messageDiv.textContent = 'Error updating story: ' + err.message;
  }
}

// ---------------------------
// 6. Delete story and its associated image
// ---------------------------
async function deleteStory(storyId) {
  if (!confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
    return;
  }

  // First fetch the story to get the image URL
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
    // Delete the story record
    const { error: deleteError } = await supabaseClient
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (deleteError) throw deleteError;

    // Delete the associated image from storage if it exists
    if (story.image_urls && story.image_urls.length > 0) {
      const imageUrl = story.image_urls[0];
      const fileName = getFileNameFromUrl(imageUrl);
      if (fileName) {
        await supabaseClient.storage.from('images').remove([fileName]);
      }
    }

    alert('Story deleted successfully.');
    // Refresh the list
    await loadStoriesForManage();

    // Clear the edit form if the deleted story was being edited
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

// ---------------------------
// 7. Initialization on page load
// ---------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadStoriesForManage();

  const editForm = document.getElementById('editStoryForm');
  if (editForm) {
    editForm.addEventListener('submit', updateStory);
  }

  // Optional: add a cancel button to clear the form
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