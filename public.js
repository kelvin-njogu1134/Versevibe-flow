// CONFIGURATION 
const SUPABASE_URL = 'https://yyebyrmgqaoiypwcchii.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PNOBDTlx2p9nIR04E7ZfOw_9dXN_AI6';
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

//  FETCH LIKES STATUS FOR ALL STORIES 
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
    // Optimistic update
    const optimisticCount = wasLiked ? currentCount - 1 : currentCount + 1;
    likeCountSpan.textContent = optimisticCount;
    likeButton.classList.toggle('liked');

    try {
        const { data: newCount, error } = await supabaseClient.rpc('toggle_like', {
            story_id: storyId,
            visitor_id: visitorId
        });
        if (error) throw error;

        // Correct with server value
        likeCountSpan.textContent = newCount;
        const newLikedState = !wasLiked;
        if (newLikedState && !likeButton.classList.contains('liked')) {
            likeButton.classList.add('liked');
        } else if (!newLikedState && likeButton.classList.contains('liked')) {
            likeButton.classList.remove('liked');
        }
    } catch (err) {
        console.error('Error toggling like:', err);
        // Revert
        likeCountSpan.textContent = currentCount;
        likeButton.classList.toggle('liked');
        alert('Failed to update like. Please try again.');
    } finally {
        likeButton.disabled = false;
    }
}

// ---------- FETCH COMMENTS ----------
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

// RENDER COMMENTS (without author name) 
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

//  SUBMIT COMMENT (without author name) 
async function submitComment(storyId, content, commentsContainer) {
    if (!content.trim()) {
        alert('Please enter a comment.');
        return false;
    }
    const { data, error } = await supabaseClient
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
    // Refresh comments after posting
    const newComments = await fetchComments(storyId);
    renderComments(newComments, commentsContainer);
    return true;
}

//  ESCAPE HTML 
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
    container.innerHTML = `<div class="loader"><span class="loader-text">Loading stories...</span></div>`;
    const { error, data: stories } = await fetchStories(category);
    if (error) {
        container.innerHTML = `<div class="error-message">❌ ${error.message}</div>`;
        return;
    }
    if (!stories || stories.length === 0) {
        container.innerHTML = `<div class="empty-message">✨ No stories yet.</div>`;
        return;
    }

    const storyIds = stories.map(s => s.id);
    const likedMap = await fetchLikesStatus(storyIds);
    container.innerHTML = '';

    // Store comment loaded status per story
    const commentLoaded = {};

    for (const story of stories) {
        const article = document.createElement('article');
        article.className = 'story';

        // IMAGE 
        let coverHtml = '';
        if (story.image_urls && Array.isArray(story.image_urls) && story.image_urls.length > 0) {
            coverHtml = `<img src="${story.image_urls[0]}" alt="${story.title}" loading="lazy" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x400?text=Image+not+found';">`;
        } else if (story.image_url) {
            coverHtml = `<img src="${story.image_url}" alt="${story.title}" loading="lazy">`;
        } else {
            coverHtml = `<div style="background:#eee;padding:2rem;text-align:center;border-radius:20px;">📷 No image available</div>`;
        }

        const dateStr = formatDate(story.created_at);
        const preview = story.full_story.substring(0, 150);
        const isLiked = likedMap[story.id] || false;
        const likeCount = story.likes_count || 0;

        //  BUILD STORY HTML 
        article.innerHTML = `
            ${coverHtml}
            <div class="story-content">
                <div class="meta">Date: ${dateStr}</div>
                <h2>Title: ${story.title}</h2>
                <div class="short-desc">Description: ${story.short_description}</div>
                <div class="story-preview">Full Story: ${preview}...</div>
                <div class="full-story" style="display:none;">${story.full_story.replace(/\n/g, '<br>')}</div>
                <button class="read-more-btn">Read More</button>
                <div class="action-buttons">
                    <button class="like-btn ${isLiked ? 'liked' : ''}" data-story-id="${story.id}">
                        ❤️ <span class="like-count">${likeCount}</span>
                    </button>
                    <button class="comment-toggle-btn" data-story-id="${story.id}">💬 Comment</button>
                </div>
                <div class="comments-section" id="comments-section-${story.id}" style="display: none;">
                    <h3>Comments</h3>
                    <div class="comments-list" id="comments-list-${story.id}"></div>
                    <form class="comment-form" data-story-id="${story.id}">
                        <textarea name="content" placeholder="Write a comment..." rows="3" required></textarea>
                        <button type="submit">Post Comment</button>
                    </form>
                </div>
            </div>
        `;
        container.appendChild(article);

        // READ MORE TOGGLE 
        const btn = article.querySelector('.read-more-btn');
        const fullStory = article.querySelector('.full-story');
        const previewText = article.querySelector('.story-preview');
        const image = article.querySelector('img');
        btn.addEventListener('click', () => {
            if (fullStory.style.display === 'none') {
                fullStory.style.display = 'block';
                previewText.style.display = 'none';
                if (image) image.style.display = 'none';
                btn.textContent = 'Read Less';
            } else {
                fullStory.style.display = 'none';
                previewText.style.display = 'block';
                if (image) image.style.display = 'block';
                btn.textContent = 'Read More';
            }
        });

        // LIKE BUTTON 
        const likeBtn = article.querySelector('.like-btn');
        const likeCountSpan = likeBtn.querySelector('.like-count');
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentCount = parseInt(likeCountSpan.textContent, 10);
            toggleLike(story.id, currentCount, likeBtn, likeCountSpan);
        });

        //  COMMENT TOGGLE BUTTON 
        const toggleBtn = article.querySelector('.comment-toggle-btn');
        const commentsSection = article.querySelector(`#comments-section-${story.id}`);
        const commentsListContainer = article.querySelector(`#comments-list-${story.id}`);
        const commentForm = article.querySelector('.comment-form');

        // Function to load and show comments
        const loadAndShowComments = async () => {
            if (!commentLoaded[story.id]) {
                // Load comments
                commentsListContainer.innerHTML = '<div class="loader-small">Loading comments...</div>';
                const comments = await fetchComments(story.id);
                renderComments(comments, commentsListContainer);
                commentLoaded[story.id] = true;
            }
            commentsSection.style.display = 'block';
        };

        // Initially hidden, toggle on click
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (commentsSection.style.display === 'none') {
                loadAndShowComments();
            } else {
                commentsSection.style.display = 'none';
            }
        });

        // COMMENT FORM SUBMIT 
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = commentForm.querySelector('textarea[name="content"]').value;
            const success = await submitComment(story.id, content, commentsListContainer);
            if () {
                commentForm.reset();
                // Ensure comments are loaded (if not, they will be after submit)
                if (!commentLoaded[story.id]) {
                    commentLoaded[story.id] = true;
                }
                // Refresh comments list
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

//  LOAD STORIES 
window.addEventListener('load', () => {
    displayStories('');
});