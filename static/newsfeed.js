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
    
    if (quickPostSection) {
        isAdmin = true;
        console.log('👑 Користувач є адміністратором');
    } else {
        console.log('👤 Користувач є звичайним користувачем');
    }
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
}

// Функції для модального вікна (для всіх)
function openModal() {
    postModal.style.display = 'block';
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
        const response = await fetch('/api/posts');
        const posts = await response.json();
        allPosts = posts;
        displayPosts(posts);
        if (isAdmin) {
            updateStats();
        }
    } catch (error) {
        console.error('Помилка завантаження постів:', error);
        if (postsContainer) {
            postsContainer.innerHTML = '<div class="loading">❌ Помилка завантаження постів</div>';
        }
    }
}

// Відображення постів
function displayPosts(posts) {
    if (!postsContainer) return;
    
    if (posts.length === 0) {
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
                    ${post.author_role === 'admin' ? '<span style="color: gold; margin-left: 5px;">👑</span>' : ''}
                </div>
                <div class="post-date">📅 ${post.date_posted}</div>
            </div>
            <h3 class="post-title">${post.title}</h3>
            <div class="post-content">${post.content}</div>
            <div class="post-actions">
                <button class="like-btn" onclick="likePost(${post.id})">
                    ❤️ <span class="like-count">${post.likes}</span>
                </button>
                ${isAdmin ? `<button class="delete-btn" onclick="deletePost(${post.id})">🗑️ Видалити</button>` : ''}
            </div>
        </div>
    `).join('');
}

// Обробка створення посту через модальне вікно (для всіх)
async function handlePostSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(postForm);
    const postData = {
        title: formData.get('title'),
        content: formData.get('content')
    };

    // Валідація
    if (!postData.title.trim() || !postData.content.trim()) {
        showMessage('❌ Будь ласка, заповніть всі поля', 'error');
        return;
    }

    try {
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
            loadPosts();
            showMessage('✅ Пост успішно опубліковано!', 'success');
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка:', error);
        showMessage('❌ Помилка при публікації посту', 'error');
    }
}

// Швидкий пост (тільки для адмінів)
async function handleQuickPost() {
    if (!isAdmin) {
        alert('Тільки адміністратор може використовувати швидке створення новин!');
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
            loadPosts();
            showMessage('✅ Важливу новину опубліковано!', 'success');
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка:', error);
        showMessage('❌ Помилка при публікації новини', 'error');
    }
}

// Лайк посту
async function likePost(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST'
        });

        const result = await response.json();
        
        if (result.success) {
            const likeBtn = document.querySelector(`[data-post-id="${postId}"] .like-count`);
            if (likeBtn) {
                likeBtn.textContent = result.likes;
            }
            if (isAdmin) {
                updateStats();
            }
            showMessage('❤️ Вам сподобався цей пост!', 'success');
        }
    } catch (error) {
        console.error('Помилка лайку:', error);
        showMessage('❌ Помилка при лайку посту', 'error');
    }
}

// Видалення посту (тільки для адміна)
async function deletePost(postId) {
    if (!isAdmin) {
        alert('Тільки адміністратор може видаляти пости!');
        return;
    }
    
    if (!confirm('Ви впевнені, що хочете видалити цей пост?')) {
        return;
    }
    
    try {
        // Тимчасово - просто оновлюємо сторінку
        // Пізніше можна додати API для видалення
        alert('Функція видалення буде додана пізніше');
        // loadPosts(); // Оновлюємо стрічку
    } catch (error) {
        console.error('Помилка видалення:', error);
        showMessage('❌ Помилка при видаленні посту', 'error');
    }
}

// Завантаження останніх користувачів (тільки для адміна)
async function loadRecentUsers() {
    if (!isAdmin) return;
    
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        displayRecentUsers(users.slice(-5));
    } catch (error) {
        console.error('Помилка завантаження користувачів:', error);
    }
}

// Відображення останніх користувачів (тільки для адміна)
function displayRecentUsers(users) {
    if (!recentUsersEl || !isAdmin) return;
    
    if (users.length === 0) {
        recentUsersEl.innerHTML = '<p>👥 Ще немає користувачів</p>';
        return;
    }

    recentUsersEl.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-avatar">${user.fullName.charAt(0)}</div>
            <div class="user-info">
                <div class="user-name">
                    ${user.fullName}
                    ${user.role === 'admin' ? '<span style="color: gold; margin-left: 5px;">👑</span>' : ''}
                </div>
                <div class="user-email">📧 ${user.email}</div>
                <div class="user-date">📅 ${user.registration_date}</div>
            </div>
        </div>
    `).join('');
}

// Оновлення статистики (тільки для адміна)
function updateStats() {
    if (!isAdmin || !totalPostsEl || !totalLikesEl) return;
    
    const totalPosts = allPosts.length;
    const totalLikes = allPosts.reduce((sum, post) => sum + post.likes, 0);
    
    totalPostsEl.textContent = totalPosts;
    totalLikesEl.textContent = totalLikes;
}

// Показ повідомлень
function showMessage(message, type) {
    // Видаляємо попередні повідомлення
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification';
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
    }, 3000);
}

// Автоматичне оновлення стрічки кожні 30 секунд
setInterval(() => {
    loadPosts();
    if (isAdmin) {
        loadRecentUsers();
    }
}, 30000);

// Обробка клавіші ESC для закриття модального вікна
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && postModal && postModal.style.display === 'block') {
        closeModalFunc();
    }
});