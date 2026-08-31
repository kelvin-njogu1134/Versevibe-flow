// CONFIGURATION
const SUPABASE_URL = 'https://lzfdrgrdaglbsafvujcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZmRyZ3JkYWdsYnNhZnZ1amNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDIwNTIsImV4cCI6MjEwMzU3ODA1Mn0.ApBYgdQoswu9BAkUUNku2qgnfcm4tEkucd1rEuTLC8o';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: Get or create visitor ID
let visitorId = localStorage.getItem('visitor_id');
if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem('visitor_id', visitorId);
}

// FORMAT DATE
function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// FETCH STORIES
async function fetchStories(category = '') {
    let query = supabaseClient
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false });
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

// FETCH LIKES STATUS FOR ALL STORIES
async function fetchLikesStatus(storyIds) {
    if (!storyIds.length) return {};
    const { data, error } = await supabaseClient
        .from('likes')
        .select('story_id')
        .eq('visitor_id', visitorId)
        .in('story_id', storyIds);
    if (error) {
        console.error('Error fetching likes status:', error);
        return {};
    }
    const likedMap = {};
    data.forEach(like => { likedMap[like.story_id] = true; });
    return likedMap;
}

// ATOMIC TOGGLE LIKE (uses RPC)
async function toggleLike(storyId, currentCount, likeButton, likeCountSpan) {
    likeButton.disabled = true;
    const wasLiked = likeButton.classList.contains('liked');
    const optimisticCount = wasLiked ? currentCount - 1 : currentCount + 1;
    likeCountSpan.textContent = optimisticCount;
    likeButton.classList.toggle('liked');

    try {
        const { data: newCount, error } = await supabaseClient.rpc('toggle_like', {
            story_id: storyId,
            visitor_id: visitorId
        });
        if (error) throw error;

        likeCountSpan.textContent = newCount;
        const newLikedState = !wasLiked;
        if (newLikedState && !likeButton.classList.contains('liked')) {
            likeButton.classList.add('liked');
        } else if (!newLikedState && likeButton.classList.contains('liked')) {
            likeButton.classList.remove('liked');
        }
    } catch (err) {
        console.error('Error toggling like:', err);
        likeCountSpan.textContent = currentCount;
        likeButton.classList.toggle('liked');
        alert('Failed to update like. Please try again.');
    } finally {
        likeButton.disabled = false;
    }
}

// FETCH COMMENTS
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

// RENDER COMMENTS
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

// SUBMIT COMMENT
async function submitComment(storyId, content, commentsContainer) {
    if (!content.trim()) {
        alert('Please enter a comment.');
        return false;
    }
    const { error } = await supabaseClient
        .from('comments')
        .insert({
            story_id: storyId,
            author_name: null,
            content: content.trim()
        })
        .select();
    if (error) {
        console.error('Error submitting comment:', error);
        alert('Failed to post comment. Please try again.');
        return false;
    }
    const newComments = await fetchComments(storyId);
    renderComments(newComments, commentsContainer);
    return true;
}

// ESCAPE HTML
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// DISPLAY STORIES
async function displayStories(category = '') {
    const container = document.getElementById('storiesContainer');
    container.innerHTML = `<div class="loader">Loading stories…</div>`;
    const { error, data: stories } = await fetchStories(category);
    if (error) {
        container.innerHTML = `<div class="error-message">${error.message}</div>`;
        return;
    }
    if (!stories || stories.length === 0) {
        container.innerHTML = `<div class="empty-message">No stories yet. Check back soon.</div>`;
        return;
    }

    const storyIds = stories.map(s => s.id);
    const likedMap = await fetchLikesStatus(storyIds);
    container.innerHTML = '';

    const commentLoaded = {};

    for (const story of stories) {
        const article = document.createElement('article');
        article.className = 'story';

        let coverHtml = '';
        if (story.image_urls && Array.isArray(story.image_urls) && story.image_urls.length > 0) {
            coverHtml = `<img src="${story.image_urls[0]}" alt="${story.title}" loading="lazy" onerror="this.style.display='none';">`;
        } else {
            coverHtml = '';
        }

        const dateStr = formatDate(story.created_at);
        const preview = story.full_story.substring(0, 220);
        const isLiked = likedMap[story.id] || false;
        const likeCount = story.likes_count || 0;

        article.innerHTML = `
            ${coverHtml}
            <div class="story-content">
                <div class="meta">${story.category ? story.category + ' — ' : ''}${dateStr}</div>
                <h2>${story.title}</h2>
                <div class="short-desc">${story.short_description}</div>
                <div class="story-preview">${preview}${story.full_story.length > 220 ? '…' : ''}</div>
                <div class="full-story">${story.full_story.replace(/\n/g, '<br>')}</div>
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
                        <textarea name="content" placeholder="Write a comment..." rows="3" required></textarea>
                        <button type="submit">Post comment</button>
                    </form>
                </div>
            </div>
        `;
        container.appendChild(article);

        const btn = article.querySelector('.read-more-btn');
        const fullStory = article.querySelector('.full-story');
        const previewText = article.querySelector('.story-preview');
        const image = article.querySelector('img');
        btn.addEventListener('click', () => {
            if (fullStory.style.display === 'none' || !fullStory.style.display) {
                fullStory.style.display = 'block';
                previewText.style.display = 'none';
                if (image) image.style.display = 'none';
                btn.textContent = 'Read less';
            } else {
                fullStory.style.display = 'none';
                previewText.style.display = 'block';
                if (image) image.style.display = 'block';
                btn.textContent = 'Read more';
            }
        });

        const likeBtn = article.querySelector('.like-btn');
        const likeCountSpan = likeBtn.querySelector('.like-count');
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentCount = parseInt(likeCountSpan.textContent, 10);
            toggleLike(story.id, currentCount, likeBtn, likeCountSpan);
        });

        const toggleBtn = article.querySelector('.comment-toggle-btn');
        const commentsSection = article.querySelector(`#comments-section-${story.id}`);
        const commentsListContainer = article.querySelector(`#comments-list-${story.id}`);
        const commentForm = article.querySelector('.comment-form');

        const loadAndShowComments = async () => {
            if (!commentLoaded[story.id]) {
                commentsListContainer.innerHTML = '<div class="loader-small">Loading comments...</div>';
                const comments = await fetchComments(story.id);
                renderComments(comments, commentsListContainer);
                commentLoaded[story.id] = true;
            }
            commentsSection.style.display = 'block';
        };

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (commentsSection.style.display === 'none') {
                loadAndShowComments();
            } else {
                commentsSection.style.display = 'none';
            }
        });

        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = commentForm.querySelector('textarea[name="content"]').value;
            const success = await submitComment(story.id, content, commentsListContainer);
            if (success) {
                commentForm.reset();
                commentLoaded[story.id] = true;
                const comments = await fetchComments(story.id);
                renderComments(comments, commentsListContainer);
            }
        });
    }
}

// CATEGORY FILTER
document.getElementById('categorySelect').addEventListener('change', (e) => {
    displayStories(e.target.value);
});

// LOAD STORIES
window.addEventListener('load', () => {
    displayStories('');
});