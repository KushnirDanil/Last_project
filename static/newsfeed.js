// Глобальні змінні
let currentUser = null;
let isAdmin = false;
let allPosts = [];

// DOM елементи
const postsContainer = document.getElementById('postsContainer');
const createPostBtn = document.getElementById('createPostBtn');
const postModal = document.getElementById('postModal');
const closeModal = document.querySelector('.close');
const postForm = document.getElementById('postForm');
const quickPost = document.getElementById('quickPost');
const quickPostBtn = document.getElementById('quickPostBtn');
const totalPostsEl = document.getElementById('totalPosts');
const totalLikesEl = document.getElementById('totalLikes');
const recentUsersEl = document.getElementById('recentUsers');

// Ініціалізація
document.addEventListener('DOMContentLoaded', function() {
    checkAdminStatus();
    loadPosts();
    if (isAdmin) {
        loadRecentUsers();
    }
    setupEventListeners();
});

// Перевірка чи поточний користувач адміністратор
function checkAdminStatus() {
    const quickPostSection = document.getElementById('quickPost');
    isAdmin = !!quickPostSection;
    console.log(isAdmin ? '👑 Користувач є адміністратором' : '👤 Користувач є звичайним користувачем');
}

// Налаштування слухачів подій
function setupEventListeners() {
    if (createPostBtn) {
        createPostBtn.addEventListener('click', openModal);
    }
    if (closeModal) {
        closeModal.addEventListener('click', closeModalFunc);
    }
    window.addEventListener('click', outsideClick);
    if (postForm) {
        postForm.addEventListener('submit', handlePostSubmit);
    }
    if (quickPostBtn) {
        quickPostBtn.addEventListener('click', handleQuickPost);
    }
    
    // Обробка клавіші ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && postModal && postModal.style.display === 'block') {
            closeModalFunc();
        }
    });
}

// Функції для модального вікна
function openModal() {
    if (postModal) {
        postModal.style.display = 'block';
        document.getElementById('postTitle')?.focus();
    }
}

function closeModalFunc() {
    if (postModal) {
        postModal.style.display = 'none';
    }
    if (postForm) {
        postForm.reset();
    }
}

function outsideClick(e) {
    if (e.target === postModal) {
        closeModalFunc();
    }
}

// Завантаження постів
async function loadPosts() {
    try {
        showLoadingState();
        const response = await fetch('/api/posts');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const posts = await response.json();
        allPosts = posts;
        displayPosts(posts);
        if (isAdmin) {
            updateStats();
        }
    } catch (error) {
        console.error('Помилка завантаження постів:', error);
        showErrorState('❌ Помилка завантаження постів');
    }
}

function showLoadingState() {
    if (postsContainer) {
        postsContainer.innerHTML = `
            <div class="post-card">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Завантаження постів...</p>
                </div>
            </div>
        `;
    }
}

function showErrorState(message) {
    if (postsContainer) {
        postsContainer.innerHTML = `
            <div class="post-card">
                <div class="error-state">
                    <h3>${message}</h3>
                    <button onclick="loadPosts()" class="retry-btn">🔄 Спробувати знову</button>
                </div>
            </div>
        `;
    }
}

// Відображення постів
function displayPosts(posts) {
    if (!postsContainer) return;
    
    if (!posts || posts.length === 0) {
        postsContainer.innerHTML = `
            <div class="post-card">
                <div class="empty-state">
                    <h3>📭 Ще немає постів</h3>
                    <p>Створіть перший пост!</p>
                </div>
            </div>
        `;
        return;
    }

    postsContainer.innerHTML = posts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-author">
                    👤 ${post.author}
                    ${post.author_role === 'admin' ? '<span class="admin-badge" title="Адміністратор">👑</span>' : ''}
                </div>
                <div class="post-date">📅 ${post.date_posted}</div>
            </div>
            <h3 class="post-title">${post.title}</h3>
            <div class="post-content">${post.content}</div>
            <div class="post-actions">
                <button class="like-btn" onclick="likePost(${post.id})" aria-label="Вподобати пост">
                    ❤️ <span class="like-count">${post.likes}</span>
                </button>
                ${isAdmin ? `
                    <button class="delete-btn" onclick="deletePost(${post.id})" aria-label="Видалити пост">
                        🗑️ Видалити
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Обробка створення посту через модальне вікно
async function handlePostSubmit(e) {
    e.preventDefault();
    
    const submitBtn = postForm.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    
    try {
        // Валідація форми
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        
        if (!title || !content) {
            showMessage('❌ Будь ласка, заповніть всі поля', 'error');
            return;
        }
        
        if (title.length > 200) {
            showMessage('❌ Заголовок занадто довгий (макс. 200 символів)', 'error');
            return;
        }
        
        // Показати стан завантаження
        submitBtn.textContent = 'Публікація...';
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        const postData = {
            title: title,
            content: content
        };

        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData)
        });

        const result = await response.json();
        
        if (result.success) {
            closeModalFunc();
            await loadPosts();
            showMessage('✅ Пост успішно опубліковано!', 'success');
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка:', error);
        showMessage('❌ Помилка при публікації посту', 'error');
    } finally {
        // Відновити кнопку
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

// Швидкий пост (тільки для адмінів)
async function handleQuickPost() {
    if (!isAdmin) {
        showMessage('❌ Тільки адміністратор може використовувати швидке створення новин!', 'error');
        return;
    }

    const content = quickPost.value.trim();
    if (!content) {
        showMessage('❌ Будь ласка, введіть текст новини', 'error');
        return;
    }

    const postData = {
        title: '🔥 Важлива новина',
        content: content
    };

    try {
        quickPostBtn.disabled = true;
        quickPostBtn.textContent = 'Публікація...';

        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData)
        });

        const result = await response.json();
        
        if (result.success) {
            quickPost.value = '';
            await loadPosts();
            showMessage('✅ Важливу новину опубліковано!', 'success');
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка:', error);
        showMessage('❌ Помилка при публікації новини', 'error');
    } finally {
        quickPostBtn.disabled = false;
        quickPostBtn.textContent = '🚀 Опублікувати новину';
    }
}

// Лайк посту
async function likePost(postId) {
    try {
        const likeBtn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
        if (likeBtn) {
            likeBtn.disabled = true;
        }

        const response = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST'
        });

        const result = await response.json();
        
        if (result.success) {
            const likeCount = document.querySelector(`[data-post-id="${postId}"] .like-count`);
            if (likeCount) {
                likeCount.textContent = result.likes;
            }
            if (isAdmin) {
                updateStats();
            }
            showMessage('❤️ Вам сподобався цей пост!', 'success');
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка лайку:', error);
        showMessage('❌ Помилка при лайку посту', 'error');
    } finally {
        const likeBtn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
        if (likeBtn) {
            likeBtn.disabled = false;
        }
    }
}

// Видалення посту (тільки для адміна)
async function deletePost(postId) {
    if (!isAdmin) {
        showMessage('❌ Тільки адміністратор може видаляти пости!', 'error');
        return;
    }
    
    if (!confirm('Ви впевнені, що хочете видалити цей пост? Цю дію не можна скасувати.')) {
        return;
    }
    
    try {
        const deleteBtn = document.querySelector(`[data-post-id="${postId}"] .delete-btn`);
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Видалення...';
        }

        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Пост успішно видалено!', 'success');
            await loadPosts();
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка видалення:', error);
        showMessage('❌ Помилка при видаленні посту', 'error');
    }
}

// Завантаження останніх користувачів (тільки для адміна)
async function loadRecentUsers() {
    if (!isAdmin || !recentUsersEl) return;
    
    try {
        const response = await fetch('/api/users');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const users = await response.json();
        displayRecentUsers(users.slice(-5));
    } catch (error) {
        console.error('Помилка завантаження користувачів:', error);
        recentUsersEl.innerHTML = '<p>❌ Помилка завантаження користувачів</p>';
    }
}

// Відображення останніх користувачів
function displayRecentUsers(users) {
    if (!recentUsersEl || !isAdmin) return;
    
    if (!users || users.length === 0) {
        recentUsersEl.innerHTML = '<p>👥 Ще немає користувачів</p>';
        return;
    }

    recentUsersEl.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-avatar" aria-label="Аватар користувача">
                ${user.fullName ? user.fullName.charAt(0).toUpperCase() : '?'}
            </div>
            <div class="user-info">
                <div class="user-name">
                    ${user.fullName || 'Невідомий користувач'}
                    ${user.role === 'admin' ? '<span class="admin-badge" title="Адміністратор">👑</span>' : ''}
                </div>
                <div class="user-email">📧 ${user.email || 'Немає email'}</div>
                <div class="user-date">📅 ${user.registration_date || 'Невідома дата'}</div>
            </div>
        </div>
    `).join('');
}

// Оновлення статистики
function updateStats() {
    if (!isAdmin || !totalPostsEl || !totalLikesEl) return;
    
    const totalPosts = allPosts.length;
    const totalLikes = allPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
    
    totalPostsEl.textContent = totalPosts;
    totalLikesEl.textContent = totalLikes;
}

// Показ повідомлень
function showMessage(message, type) {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 10px;
        z-index: 10000;
        font-weight: bold;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Анімація появи
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Анімація зникнення
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}

// Автоматичне оновлення стрічки
setInterval(() => {
    loadPosts();
    if (isAdmin) {
        loadRecentUsers();
    }
}, 30000);

// Експорт функцій для глобального використання
window.likePost = likePost;
window.deletePost = deletePost;
window.loadPosts = loadPosts;