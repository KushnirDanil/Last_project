// Глобальні змінні для зберігання стану додатку
let currentUser = null;    // Поточний користувач
let isAdmin = false;       // Чи є користувач адміністратором
let allPosts = [];         // Масив всіх постів

// DOM елементи - отримання посилань на HTML елементи
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

// Ініціалізація додатку при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    checkAdminStatus();  // Перевірка чи користувач адмін
    loadPosts();         // Завантаження постів
    if (isAdmin) {
        loadRecentUsers();  // Завантаження користувачів (тільки для адміна)
    }
    setupEventListeners();  // Налаштування обробників подій
});

// Перевірка чи поточний користувач адміністратор
function checkAdminStatus() {
    // Перевіряємо чи існує елемент швидкого посту (тільки для адмінів)
    const quickPostSection = document.getElementById('quickPost');
    isAdmin = !!quickPostSection;  // !! перетворює в boolean
    console.log(isAdmin ? '👑 Користувач є адміністратором' : '👤 Користувач є звичайним користувачем');
}

// Налаштування слухачів подій для всіх інтерактивних елементів
function setupEventListeners() {
    // Кнопка створення посту
    if (createPostBtn) {
        createPostBtn.addEventListener('click', openModal);
    }
    // Кнопка закриття модального вікна
    if (closeModal) {
        closeModal.addEventListener('click', closeModalFunc);
    }
    // Закриття модального вікна при кліку поза ним
    window.addEventListener('click', outsideClick);
    // Форма створення посту
    if (postForm) {
        postForm.addEventListener('submit', handlePostSubmit);
    }
    // Швидкий пост для адміністратора
    if (quickPostBtn) {
        quickPostBtn.addEventListener('click', handleQuickPost);
    }
    
    // Обробка клавіші ESC для закриття модальних вікон
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && postModal && postModal.style.display === 'block') {
            closeModalFunc();
        }
    });
}

// Функції для роботи з модальним вікном створення посту

/**
 * Відкриття модального вікна для створення посту
 */
function openModal() {
    if (postModal) {
        postModal.style.display = 'block';  // Показуємо вікно
        document.getElementById('postTitle')?.focus();  // Фокус на поле заголовку
    }
}

/**
 * Закриття модального вікна
 */
function closeModalFunc() {
    if (postModal) {
        postModal.style.display = 'none';  // Ховаємо вікно
    }
    if (postForm) {
        postForm.reset();  // Очищаємо форму
    }
}

/**
 * Закриття модального вікна при кліку поза ним
 */
function outsideClick(e) {
    if (e.target === postModal) {
        closeModalFunc();
    }
}

// Функції для роботи з постами

/**
 * Завантаження постів з сервера
 */
async function loadPosts() {
    try {
        showLoadingState();  // Показуємо індикатор завантаження
        
        // Виконуємо GET запит до API
        const response = await fetch('/api/posts');
        
        // Перевіряємо чи відповідь успішна
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Парсимо JSON відповідь
        const posts = await response.json();
        allPosts = posts;  // Зберігаємо пости в глобальну змінну
        displayPosts(posts);  // Відображаємо пости на сторінці
        
        // Оновлюємо статистику (тільки для адміна)
        if (isAdmin) {
            updateStats();
        }
    } catch (error) {
        console.error('Помилка завантаження постів:', error);
        showErrorState('❌ Помилка завантаження постів');  // Показуємо повідомлення про помилку
    }
}

/**
 * Показ стану завантаження
 */
function showLoadingState() {
    if (postsContainer) {
        postsContainer.innerHTML = `
            <div class="post-card">
                <div class="loading-state">
                    <div class="loading-spinner"></div>  <!-- Анімація завантаження -->
                    <p>Завантаження постів...</p>
                </div>
            </div>
        `;
    }
}

/**
 * Показ стану помилки
 */
function showErrorState(message) {
    if (postsContainer) {
        postsContainer.innerHTML = `
            <div class="post-card">
                <div class="error-state">
                    <h3>${message}</h3>
                    <!-- Кнопка повторної спроби -->
                    <button onclick="loadPosts()" class="retry-btn">🔄 Спробувати знову</button>
                </div>
            </div>
        `;
    }
}

/**
 * Відображення постів на сторінці
 * @param {Array} posts - Масив постів для відображення
 */
function displayPosts(posts) {
    if (!postsContainer) return;  // Перевірка наявності контейнера
    
    // Якщо постів немає - показуємо повідомлення
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

    // Генеруємо HTML для кожного посту
    postsContainer.innerHTML = posts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-author">
                    👤 ${post.author}
                    ${post.author_role === 'admin' ? '<span class="admin-badge" title="Адміністратор">👑</span>' : ''}
                    ${post.is_author ? '<span class="author-badge" title="Ваш пост">✏️</span>' : ''}
                </div>
                <div class="post-date">📅 ${post.date_posted}</div>
            </div>
            <h3 class="post-title">${post.title}</h3>
            <div class="post-content">${post.content}</div>
            <div class="post-actions">
                ${post.is_author ? `
                    <!-- Для авторів - disabled кнопка лайку -->
                    <button class="like-btn disabled" disabled title="Ви не можете лайкати власні пости">
                        ❤️ <span class="like-count">${post.likes}</span>
                    </button>
                ` : `
                    <!-- Для інших користувачів - активна кнопка лайку -->
                    <button class="like-btn ${post.user_liked ? 'liked' : ''}" 
                            onclick="toggleLike(${post.id}, ${post.user_liked})" 
                            aria-label="${post.user_liked ? 'Прибрати лайк' : 'Вподобати пост'}">
                        ${post.user_liked ? '💖' : '❤️'} 
                        <span class="like-count">${post.likes}</span>
                    </button>
                `}
                ${isAdmin ? `
                    <!-- Кнопка видалення тільки для адміністратора -->
                    <button class="delete-btn" onclick="deletePost(${post.id})" aria-label="Видалити пост">
                        🗑️ Видалити
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');  // join('') перетворює масив в один рядок
}

/**
 * Обробка створення посту через модальне вікно
 * @param {Event} e - Об'єкт події форми
 */
async function handlePostSubmit(e) {
    e.preventDefault();  // Запобігаємо стандартній відправці форми
    
    const submitBtn = postForm.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    
    try {
        // Валідація форми
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        
        // Перевірка наявності всіх полів
        if (!title || !content) {
            showMessage('❌ Будь ласка, заповніть всі поля', 'error');
            return;
        }
        
        // Перевірка довжини заголовка
        if (title.length > 200) {
            showMessage('❌ Заголовок занадто довгий (макс. 200 символів)', 'error');
            return;
        }
        
        // Показати стан завантаження на кнопці
        submitBtn.textContent = 'Публікація...';
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        // Дані для відправки
        const postData = {
            title: title,
            content: content
        };

        // Відправка POST запиту на сервер
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData)
        });

        // Отримання результату
        const result = await response.json();
        
        if (result.success) {
            closeModalFunc();  // Закриваємо модальне вікно
            await loadPosts(); // Перезавантажуємо пости
            showMessage('✅ Пост успішно опубліковано!', 'success');
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка:', error);
        showMessage('❌ Помилка при публікації посту', 'error');
    } finally {
        // Відновлюємо кнопку в початковий стан
        submitBtn.textContent = originalText;
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

/**
 * Обробка швидкого посту (тільки для адміністратора)
 */
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

    // Дані для швидкого посту
    const postData = {
        title: '🔥 Важлива новина',
        content: content
    };

    try {
        // Блокуємо кнопку під час відправки
        quickPostBtn.disabled = true;
        quickPostBtn.textContent = 'Публікація...';

        // Відправка запиту
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData)
        });

        const result = await response.json();
        
        if (result.success) {
            quickPost.value = '';  // Очищаємо текстове поле
            await loadPosts();     // Перезавантажуємо пости
            showMessage('✅ Важливу новину опубліковано!', 'success');
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка:', error);
        showMessage('❌ Помилка при публікації новини', 'error');
    } finally {
        // Відновлюємо кнопку
        quickPostBtn.disabled = false;
        quickPostBtn.textContent = '🚀 Опублікувати новину';
    }
}

/**
 * Перемикач лайку (додати/прибрати)
 * @param {number} postId - ID посту
 * @param {boolean} isCurrentlyLiked - Чи вже лайкнуто
 */
async function toggleLike(postId, isCurrentlyLiked) {
    try {
        const likeBtn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
        if (!likeBtn) return;

        // Блокуємо кнопку під час запиту
        likeBtn.disabled = true;

        // Визначаємо який ендпоінт викликати
        const endpoint = isCurrentlyLiked ? 'unlike' : 'like';
        
        // Відправка запиту
        const response = await fetch(`/api/posts/${postId}/${endpoint}`, {
            method: 'POST'
        });

        const result = await response.json();
        
        if (result.success) {
            // Оновлюємо лічильник лайків в інтерфейсі
            const likeCount = document.querySelector(`[data-post-id="${postId}"] .like-count`);
            if (likeCount) {
                likeCount.textContent = result.likes;
            }
            
            if (isCurrentlyLiked) {
                // Видаляємо лайк - оновлюємо інтерфейс
                likeBtn.classList.remove('liked');
                likeBtn.innerHTML = '❤️ <span class="like-count">' + result.likes + '</span>';
                likeBtn.setAttribute('aria-label', 'Вподобати пост');
                likeBtn.onclick = function() { toggleLike(postId, false); };
                showMessage('💔 Лайк видалено!', 'success');
            } else {
                // Додаємо лайк - оновлюємо інтерфейс
                likeBtn.classList.add('liked');
                likeBtn.innerHTML = '💖 <span class="like-count">' + result.likes + '</span>';
                likeBtn.setAttribute('aria-label', 'Прибрати лайк');
                likeBtn.onclick = function() { toggleLike(postId, true); };
                showMessage('💖 Пост вподобано!', 'success');
            }
            
            // Оновлюємо статистику (тільки для адміна)
            if (isAdmin) {
                updateStats();
            }
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка лайку:', error);
        showMessage('❌ Помилка при взаємодії з постом', 'error');
    } finally {
        // Розблоковуємо кнопку
        const likeBtn = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
        if (likeBtn) {
            likeBtn.disabled = false;
        }
    }
}

/**
 * Видалення посту (тільки для адміна)
 * @param {number} postId - ID посту для видалення
 */
async function deletePost(postId) {
    if (!isAdmin) {
        showMessage('❌ Тільки адміністратор може видаляти пости!', 'error');
        return;
    }
    
    // Підтвердження видалення
    if (!confirm('Ви впевнені, що хочете видалити цей пост? Цю дію не можна скасувати.')) {
        return;
    }
    
    try {
        const deleteBtn = document.querySelector(`[data-post-id="${postId}"] .delete-btn`);
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Видалення...';
        }

        // Відправка DELETE запиту
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Пост успішно видалено!', 'success');
            await loadPosts();  // Перезавантажуємо пости
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Помилка видалення:', error);
        showMessage('❌ Помилка при видаленні посту', 'error');
    }
}

/**
 * Завантаження останніх користувачів (тільки для адміна)
 */
async function loadRecentUsers() {
    if (!isAdmin || !recentUsersEl) return;
    
    try {
        const response = await fetch('/api/users');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const users = await response.json();
        // Беремо останніх 5 користувачів
        displayRecentUsers(users.slice(-5));
    } catch (error) {
        console.error('Помилка завантаження користувачів:', error);
        recentUsersEl.innerHTML = '<p>❌ Помилка завантаження користувачів</p>';
    }
}

/**
 * Відображення останніх користувачів
 * @param {Array} users - Масив користувачів
 */
function displayRecentUsers(users) {
    if (!recentUsersEl || !isAdmin) return;
    
    if (!users || users.length === 0) {
        recentUsersEl.innerHTML = '<p>👥 Ще немає користувачів</p>';
        return;
    }

    // Генеруємо HTML для кожного користувача
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

/**
 * Оновлення статистики (тільки для адміна)
 */
function updateStats() {
    if (!isAdmin || !totalPostsEl || !totalLikesEl) return;
    
    // Підрахунок загальної кількості постів та лайків
    const totalPosts = allPosts.length;
    const totalLikes = allPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
    
    // Оновлення відображення
    totalPostsEl.textContent = totalPosts;
    totalLikesEl.textContent = totalLikes;
}

/**
 * Показ повідомлень для користувача
 * @param {string} message - Текст повідомлення
 * @param {string} type - Тип повідомлення ('success' або 'error')
 */
function showMessage(message, type) {
    // Видаляємо старі повідомлення
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Створюємо нове повідомлення
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
    // Стилі для повідомлення
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
    
    // Анімація зникнення через 3 секунди
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

// Експорт функцій для глобального використання в HTML
// Це дозволяє викликати функції з атрибутів onclick в HTML
window.toggleLike = toggleLike;
window.deletePost = deletePost;
window.loadPosts = loadPosts;