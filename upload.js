// !!! REPLACE WITH YOUR ACTUAL SUPABASE PROJECT URL AND ANON KEY !!!
const SUPABASE_URL = 'https://yyebyrmgqaoiypwcchii.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PNOBDTlx2p9nIR04E7ZfOw_9dXN_AI6';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const input = document.getElementById('imageInput');
const submitBtn = document.getElementById('submitBtn');
const gallery = document.getElementById('gallery');

// Function to load and display all images from the bucket
async function loadGallery() {
  try {
    // List all files in the 'images' bucket
    const { data: files, error } = await supabaseClient.storage
      .from('images')
      .list();

    if (error) {
      console.error('Error listing files:', error.message);
      gallery.innerHTML = '<p style="color: red;">Failed to load images.</p>';
      return;
    }

    // Clear gallery and remove loading text
    gallery.innerHTML = '';

    if (!files || files.length === 0) {
      gallery.innerHTML = '<p>No images yet.</p>';
      return;
    }

    // Loop through files and create image elements
    files.forEach(file => {
      // Get public URL for each file
      const { publicURL } = supabaseClient.storage
        .from('images')
        .getPublicUrl(file.name);

      const img = document.createElement('img');
      img.src = publicURL;
      img.alt = file.name;
      gallery.appendChild(img);
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    gallery.innerHTML = '<p style="color: red;">An error occurred.</p>';
  }
}

// Load gallery when page loads
loadGallery();

// Handle upload
submitBtn.addEventListener('click', async () => {
  const files = input.files;

  if (!files.length) {
    alert('Please select at least one image.');
    return;
  }

  // Show uploading indicator
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Uploading...';
  submitBtn.disabled = true;

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = `${Date.now()}-${file.name}`; // unique name

      const { data, error } = await supabaseClient.storage
        .from('images')
        .upload(fileName, file);

      if (error) {
        console.error('Upload error:', error.message);
        alert(`Upload failed for ${file.name}: ${error.message}`);
      } else {
        console.log('Uploaded:', data.path);
      }
    }

    // After all uploads, refresh the gallery
    await loadGallery();
  } finally {
    // Reset button and input
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    input.value = '';
  }
});