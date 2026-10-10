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
  likeButton.setAttribute('aria-label', wasLiked ? 'Like story' : 'Unlike story');

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
    likeButton.setAttribute('aria-label', wasLiked ? 'Unlike story' : 'Like story');
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

    const fullStoryText = story.full_story ?? '';
    const preview = fullStoryText.substring(0, 220);
    const isLiked = likedMap[story.id] || false;
    const likeCount = story.likes_count || 0;

    article.innerHTML = `
      ${coverHtml}
      <div class="story-content">
        <button class="reader-close-btn" type="button" aria-label="Back to stories">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="m15 18-6-6 6-6M9 12h12"></path>
          </svg>
          Back to stories
        </button>
        <div class="meta">${story.category ? escapeHtml(story.category) + ' — ' : ''}${formatDate(story.created_at)}</div>
        <h2>${title}</h2>
        <div class="short-desc">${escapeHtml(story.short_description)}</div>
        <div class="story-preview">${escapeHtml(preview)}${fullStoryText.length > 220 ? '…' : ''}</div>
        <div class="full-story">${escapeHtml(fullStoryText).replace(/\n/g, '<br>')}</div>
        <button class="read-more-btn" aria-expanded="false">Read more</button>
        <div class="action-buttons">
          <button class="like-btn ${isLiked ? 'liked' : ''}" data-story-id="${story.id}" aria-label="${isLiked ? 'Unlike' : 'Like'} story">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"></path>
            </svg>
            <span class="like-count">${likeCount}</span>
          </button>
          <button class="comment-toggle-btn" data-story-id="${story.id}">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"></path>
            </svg>
            Comment
          </button>
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
    const closeReaderButton = article.querySelector('.reader-close-btn');

    const closeReader = () => {
      article.classList.remove('story-expanded');
      article.removeAttribute('role');
      article.removeAttribute('aria-modal');
      article.removeAttribute('aria-label');
      article.removeAttribute('tabindex');
      document.body.classList.remove('story-reader-open');
      fullStory.style.display = 'none';
      previewText.style.display = 'block';
      btn.textContent = 'Read more';
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    };

    btn.addEventListener('click', () => {
      if (article.classList.contains('story-expanded')) {
        closeReader();
        return;
      }

      article.classList.add('story-expanded');
      article.setAttribute('role', 'dialog');
      article.setAttribute('aria-modal', 'true');
      article.setAttribute('aria-label', `Reading ${story.title}`);
      article.setAttribute('tabindex', '-1');
      document.body.classList.add('story-reader-open');
      fullStory.style.display = 'block';
      previewText.style.display = 'none';
      btn.textContent = 'Read less';
      btn.setAttribute('aria-expanded', 'true');
      article.focus();
    });
    closeReaderButton.addEventListener('click', closeReader);

    article.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && article.classList.contains('story-expanded')) {
        closeReader();
      }
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