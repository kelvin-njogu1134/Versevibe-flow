import { supabase as supabaseClient } from './supabaseClient.js';

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function fetchStories(category = '') {
  let query = supabaseClient
    .from('stories')
    .select('*')
    .order('created_at', { ascending: false });
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) {
    console.error('Supabase error:', error);
    return { error, data: null };
  }
  return { error: null, data };
}

// RLS only returns the logged-in user's own likes
async function fetchLikesStatus(storyIds) {
  if (!storyIds.length) return {};
  const { data, error } = await supabaseClient
    .from('likes')
    .select('story_id')
    .in('story_id', storyIds);
  if (error) {
    console.error('Error fetching likes status:', error);
    return {};
  }
  const likedMap = {};
  data.forEach(like => { likedMap[like.story_id] = true; });
  return likedMap;
}

async function toggleLike(storyId, currentCount, likeButton, likeCountSpan) {
  likeButton.disabled = true;
  const wasLiked = likeButton.classList.contains('liked');
  likeCountSpan.textContent = wasLiked ? currentCount - 1 : currentCount + 1;
  likeButton.classList.toggle('liked');

  try {
    const { data: newCount, error } = await supabaseClient.rpc('toggle_like', {
      p_story_id: storyId
    });
    if (error) throw error;
    likeCountSpan.textContent = newCount;
  } catch (err) {
    console.error('Error toggling like:', err);
    likeCountSpan.textContent = currentCount;
    likeButton.classList.toggle('liked');
    alert('Failed to update like. Please try again.');
  } finally {
    likeButton.disabled = false;
  }
}

async function fetchComments(storyId) {
  const { data, error } = await supabaseClient
    .from('comments')
    .select('*')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
  return data;
}

function renderComments(comments, container) {
  if (!comments.length) {
    container.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
    return;
  }
  container.innerHTML = comments.map(comment => `
    <div class="comment">
      <div class="comment-content">${escapeHtml(comment.content)}</div>
      <div class="comment-date">${formatDate(comment.created_at)}</div>
    </div>
  `).join('');
}

async function submitComment(storyId, content, commentsContainer) {
  if (!content.trim()) {
    alert('Please enter a comment.');
    return false;
  }
  const { error } = await supabaseClient
    .from('comments')
    .insert({ story_id: storyId, author_name: null, content: content.trim() });

  if (error) {
    console.error('Error submitting comment:', error);
    alert('Failed to post comment. Please try again.');
    return false;
  }
  renderComments(await fetchComments(storyId), commentsContainer);
  return true;
}

async function displayStories(category = '') {
  const container = document.getElementById('storiesContainer');
  container.innerHTML = `<div class="loader">Loading stories…</div>`;

  const { error, data: stories } = await fetchStories(category);
  if (error) {
    container.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`;
    return;
  }
  if (!stories || stories.length === 0) {
    container.innerHTML = `<div class="empty-message">No stories yet. Check back soon.</div>`;
    return;
  }

  const likedMap = await fetchLikesStatus(stories.map(s => s.id));
  container.innerHTML = '';
  const commentLoaded = {};

  for (const story of stories) {
    const article = document.createElement('article');
    article.className = 'story';

    const title = escapeHtml(story.title);
    const coverHtml = (Array.isArray(story.image_urls) && story.image_urls.length > 0)
      ? `<img src="${escapeHtml(story.image_urls[0])}" alt="${title}" loading="lazy" onerror="this.style.display='none';">`
      : '';

    const preview = story.full_story.substring(0, 220);
    const isLiked = likedMap[story.id] || false;
    const likeCount = story.likes_count || 0;

    article.innerHTML = `
      ${coverHtml}
      <div class="story-content">
        <div class="meta">${story.category ? escapeHtml(story.category) + ' — ' : ''}${formatDate(story.created_at)}</div>
        <h2>${title}</h2>
        <div class="short-desc">${escapeHtml(story.short_description)}</div>
        <div class="story-preview">${escapeHtml(preview)}${story.full_story.length > 220 ? '…' : ''}</div>
        <div class="full-story">${escapeHtml(story.full_story).replace(/\n/g, '<br>')}</div>
        <button class="read-more-btn">Read more</button>
        <div class="action-buttons">
          <button class="like-btn ${isLiked ? 'liked' : ''}" data-story-id="${story.id}">
            ♥ <span class="like-count">${likeCount}</span>
          </button>
          <button class="comment-toggle-btn" data-story-id="${story.id}">Comment</button>
        </div>
        <div class="comments-section" id="comments-section-${story.id}" style="display: none;">
          <h3>Comments</h3>
          <div class="comments-list" id="comments-list-${story.id}"></div>
          <form class="comment-form" data-story-id="${story.id}">
            <textarea name="content" placeholder="Write a comment..." rows="3" required maxlength="2000"></textarea>
            <button type="submit">Post comment</button>
          </form>
        </div>
      </div>
    `;
    container.appendChild(article);

    // Read more / less
    const btn = article.querySelector('.read-more-btn');
    const fullStory = article.querySelector('.full-story');
    const previewText = article.querySelector('.story-preview');
    const image = article.querySelector('img');
    btn.addEventListener('click', () => {
      const open = fullStory.style.display === 'block';
      fullStory.style.display = open ? 'none' : 'block';
      previewText.style.display = open ? 'block' : 'none';
      if (image) image.style.display = open ? 'block' : 'none';
      btn.textContent = open ? 'Read more' : 'Read less';
    });

    // Likes
    const likeBtn = article.querySelector('.like-btn');
    const likeCountSpan = likeBtn.querySelector('.like-count');
    likeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLike(story.id, parseInt(likeCountSpan.textContent, 10), likeBtn, likeCountSpan);
    });

    // Comments
    const toggleBtn = article.querySelector('.comment-toggle-btn');
    const commentsSection = article.querySelector(`#comments-section-${story.id}`);
    const commentsList = article.querySelector(`#comments-list-${story.id}`);
    const commentForm = article.querySelector('.comment-form');

    toggleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (commentsSection.style.display === 'none') {
        if (!commentLoaded[story.id]) {
          commentsList.innerHTML = '<div class="loader-small">Loading comments...</div>';
          renderComments(await fetchComments(story.id), commentsList);
          commentLoaded[story.id] = true;
        }
        commentsSection.style.display = 'block';
      } else {
        commentsSection.style.display = 'none';
      }
    });

    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = commentForm.querySelector('textarea[name="content"]').value;
      if (await submitComment(story.id, content, commentsList)) {
        commentForm.reset();
        commentLoaded[story.id] = true;
      }
    });
  }
}

document.getElementById('categorySelect').addEventListener('change', (e) => {
  displayStories(e.target.value);
});

window.addEventListener('load', () => displayStories(''));