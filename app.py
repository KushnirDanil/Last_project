from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date
import os
import hashlib
import html
import re

# Ініціалізація Flask додатку
app = Flask(__name__)
# Налаштування бази даних SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
# Вимкнення трекінгу модифікацій для економії пам'яті
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Секретний ключ для сесій (береться з змінних середовища або використовується дефолтний)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')

# Ініціалізація бази даних
db = SQLAlchemy(app)

# --- MODELS ----------------------------------------------------------------------------------------

class User(db.Model):
    """
    Модель користувача для бази даних
    Зберігає інформацію про зареєстрованих користувачів
    """
    id = db.Column(db.Integer, primary_key=True)  # Унікальний ID користувача
    fullName = db.Column(db.String(100), nullable=False)  # Повне ім'я (обов'язкове)
    email = db.Column(db.String(100), unique=True, nullable=False)  # Email (унікальний)
    phone = db.Column(db.String(20), nullable=False)  # Номер телефону
    password = db.Column(db.String(128), nullable=False)  # Хеш пароля
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)  # Дата реєстрації
    role = db.Column(db.String(20), default='user')  # Роль (user/admin)
    # Зв'язок один-до-багатьох: один користувач може мати багато постів
    posts = db.relationship('Post', backref='author', lazy=True)
    # Зв'язок один-до-багатьох: один користувач може мати багато лайків
    likes = db.relationship('Like', backref='user', lazy=True)

class Post(db.Model):
    """
    Модель посту для бази даних
    Зберігає інформацію про пости користувачів
    """
    id = db.Column(db.Integer, primary_key=True)  # Унікальний ID посту
    title = db.Column(db.String(200), nullable=False)  # Заголовок посту
    content = db.Column(db.Text, nullable=False)  # Зміст посту
    date_posted = db.Column(db.DateTime, default=datetime.utcnow)  # Дата публікації
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # ID автора
    likes = db.Column(db.Integer, default=0)  # Кількість лайків
    # Зв'язок один-до-багатьох: один пост може мати багато лайків
    post_likes = db.relationship('Like', backref='post', lazy=True)

class Like(db.Model):
    """
    Модель лайку для бази даних
    Зберігає інформацію про лайки користувачів
    """
    id = db.Column(db.Integer, primary_key=True)  # Унікальний ID лайку
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # ID користувача
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)  # ID посту
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # Дата лайку
    
    # Унікальний обмежувач - один користувач може лайкнути пост тільки один раз
    # Це запобігає подвійним лайкам від одного користувача
    __table_args__ = (db.UniqueConstraint('user_id', 'post_id', name='_user_post_uc'),)

# --- FUNCTIONS ----------------------------------------------------------------------------------

def hash_password(password):
    """
    Хешування пароля за допомогою SHA-256
    """
    return hashlib.sha256(password.encode()).hexdigest()

def escape_html(text):
    """
    Екранування HTML символів для запобігання XSS атак
    Наприклад: <script> -> &lt;script&gt;
    """
    return html.escape(str(text))

def validate_email(email):
    """
    Валідація email за допомогою регулярного виразу
    Перевіряє чи email має правильний формат
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    """
    Валідація номера телефону
    Перевіряє базовий формат телефонного номера
    """
    pattern = r'^\+?[0-9\s\-\(\)]{10,}$'
    return re.match(pattern, phone) is not None

def init_db():
    """
    Ініціалізація бази даних
    Створює всі таблиці та додає адміністратора за замовчуванням
    """
    with app.app_context():
        # Створення всіх таблиць в базі даних
        db.create_all()
        
        # Перевірка чи існує адміністратор
        admin = User.query.filter_by(email='dankusnir09@gmail.com').first()
        if not admin:
            # Створення адміністратора за замовчуванням
            admin_user = User(
                fullName='Кушнір Даніїл',
                email='dankusnir09@gmail.com',
                phone='0977138005',
                password=hash_password('admin123'),
                role='admin'
            )
            db.session.add(admin_user)
            db.session.commit()
            print("✅ Адміністратор створений!")
            print("📧 Email: dankusnir09@gmail.com")
            print("🔑 Пароль: admin123")

# Виклик ініціалізації бази даних при запуску
with app.app_context():
    init_db()

# --- ROUTES --------------------------------------------------------------------------------------

# LOGON - система реєстрації та входу

@app.route('/register', methods=['POST'])
def register():
    """
    Обробка реєстрації нового користувача
    Приймає POST запит з даними форми
    """
    try:
        # Якщо користувач вже увійшов, перенаправляємо на головну
        if 'user_id' in session:
            return redirect('/home')
            
        # Отримання та очищення даних з форми
        fullName = escape_html(request.form['fullName'].strip())
        email = request.form['email'].strip().lower()
        phone = request.form['phone'].strip()
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        
        # Перевірка наявності всіх обов'язкових полів
        if not all([fullName, email, phone, password, confirm_password]):
            flash('Будь ласка, заповніть всі обов\'язкові поля!')
            return redirect('/index')
        
        # Валідація довжини імені
        if len(fullName) < 2 or len(fullName) > 100:
            flash('Ім\'я та прізвище має містити від 2 до 100 символів!')
            return redirect('/index')
        
        # Валідація email
        if not validate_email(email):
            flash('Будь ласка, введіть коректний email!')
            return redirect('/index')
        
        # Валідація телефону
        if not validate_phone(phone):
            flash('Будь ласка, введіть коректний номер телефону!')
            return redirect('/index')
        
        # Перевірка співпадіння паролів
        if password != confirm_password:
            flash('Паролі не співпадають!')
            return redirect('/index')
        
        # Перевірка довжини пароля
        if len(password) < 6:
            flash('Пароль має бути не менше 6 символів!')
            return redirect('/index')
        
        # Перевірка чи email вже зареєстрований
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Користувач з таким email вже існує! Увійдіть в систему.')
            return redirect('/index')
        
        # Встановлення ролі (за замовчуванням 'user')
        role = 'user'
        
        # Спеціальна перевірка для адміністратора
        existing_admin = User.query.filter_by(role='admin').first()
        if email == 'dankusnir09@gmail.com' and existing_admin:
            flash('Адміністратор вже існує! Будь ласка, використовуйте інший email.')
            return redirect('/index')
        
        # Створення нового користувача
        new_user = User(
            fullName=fullName, 
            email=email, 
            phone=phone, 
            password=hash_password(password),
            role=role
        )
        db.session.add(new_user)
        db.session.commit()
        
        # Збереження інформації про користувача в сесії
        session['user_id'] = new_user.id
        session['user_email'] = new_user.email
        session['user_role'] = new_user.role
        
        flash('Реєстрація успішна! Ви автоматично увійшли в систему.')
        return redirect('/home')
    except Exception as e:
        # Обробка будь-якої помилки
        flash('Помилка реєстрації: ' + str(e))
        return redirect('/index')

@app.route('/login', methods=['POST'])
def login():
    """
    Обробка входу користувача
    Перевіряє email та пароль, створює сесію
    """

    # Якщо користувач вже увійшов, перенаправляємо на головну
    if 'user_id' in session:
        return redirect('/home')
        
    # Отримання даних з форми
    email = request.form['email'].strip().lower()
    password = request.form['password']
    
    # Перевірка наявності даних
    if not email or not password:
        flash('Будь ласка, заповніть всі поля!')
        return redirect('/index')
    
    # Пошук користувача в базі даних
    user = User.query.filter_by(email=email).first()
    
    # Перевірка пароля (порівнюємо хеші)
    if user and user.password == hash_password(password):
        # Збереження інформації в сесії
        session['user_id'] = user.id
        session['user_email'] = user.email
        session['user_role'] = user.role
        flash(f'Вітаємо, {user.fullName}! Ви успішно увійшли.')
        return redirect('/home')
    else:
        flash('Невірний email або пароль!')
        return redirect('/index')
        
 

@app.route('/logout')
def logout():
    """
    Вихід з системи
    Очищує всі дані сесії
    """
    session.clear()
    flash('Ви вийшли з системи.')
    return redirect('/index')

# Головна сторінка (home)
@app.route('/')
@app.route('/home')
def home():
    """
    Головна сторінка додатку
    Показує інформацію про користувача та його пости
    """
    # Перевірка авторизації
    if 'user_id' not in session:
        return redirect('/index')
    
    # Отримання даних для сторінки
    users = User.query.all()
    today = date.today()
    today_users = User.query.filter(db.func.date(User.registration_date) == today).count()
    
    current_user = User.query.get(session['user_id'])
    
    # Отримуємо пости поточного користувача
    user_posts = Post.query.filter_by(user_id=current_user.id).order_by(Post.date_posted.desc()).all()
    
    # Отримуємо пости, які користувач лайкнув
    liked_posts = Post.query.join(Like).filter(
        Like.user_id == current_user.id
    ).order_by(Post.date_posted.desc()).all()
    
    # Рендеринг шаблону з переданими даними
    return render_template('home.html', 
                         users=users, 
                         today_users=today_users,
                         current_user=current_user,
                         user_posts=user_posts,
                         liked_posts=liked_posts)

# Сторінка реєстрації та входу
@app.route('/index')
def index():
    """
    Сторінка входу/реєстрації
    Якщо користувач вже авторизований - перенаправляє на головну
    """
    # Якщо користувач вже увійшов, перенаправляємо на головну
    if 'user_id' in session:
        return redirect('/home')
    
    return render_template('index.html')

@app.route('/newsfeed')
def newsfeed():
    """
    Сторінка стрічки новин
    Показує всі пости спільноти
    """
    # Перевірка авторизації
    if 'user_id' not in session:
        flash('Будь ласка, увійдіть в систему для перегляду стрічки.')
        return redirect('/index')
    
    # Отримання поточного користувача
    current_user = User.query.get(session.get('user_id'))
    if not current_user:
        # Якщо користувача не знайдено - очищаємо сесію
        session.clear()
        flash('Сесія закінчилася. Будь ласка, увійдіть знову.')
        return redirect('/index')
    
    return render_template('newsfeed.html', current_user=current_user)

# --------------------------------------------------------------------------------------------
# API маршрути - для взаємодії з фронтендом через AJAX

@app.route('/api/users')
def get_users():
    """
    API для отримання списку всіх користувачів
    Використовується адміністратором
    """
    try:
        users = User.query.all()
        users_data = []
        # Формування списку користувачів для JSON відповіді
        for user in users:
            users_data.append({
                'id': user.id,
                'fullName': escape_html(user.fullName),
                'email': user.email,
                'phone': user.phone,
                'role': user.role,
                'registration_date': user.registration_date.strftime('%d.%m.%Y %H:%M')
            })
        return jsonify(users_data)
    except Exception as e:
        # Обробка помилок сервера
        return jsonify({'error': 'Помилка сервера'}), 500

@app.route('/api/posts', methods=['GET', 'POST'])
def handle_posts():
    """
    API для роботи з постами
    GET - отримання списку постів
    POST - створення нового посту
    """
    try:
        if request.method == 'POST':
            # Перевірка авторизації для створення посту
            if 'user_id' not in session:
                return jsonify({'success': False, 'message': 'Увійдіть в систему!'}), 401
            
            # Отримання JSON даних
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'message': 'Невірний формат даних'}), 400
            
            # Отримання та очищення даних
            title = escape_html(data.get('title', '').strip())
            content = escape_html(data.get('content', '').strip())
            
            # Валідація обов'язкових полів
            if not title or not content:
                return jsonify({'success': False, 'message': 'Заголовок та зміст обов\'язкові'}), 400
            
            # Валідація довжини заголовка
            if len(title) > 200:
                return jsonify({'success': False, 'message': 'Заголовок занадто довгий'}), 400
            
            # Перевірка існування користувача
            user_id = session.get('user_id')
            user = User.query.get(user_id)
            if not user:
                return jsonify({'success': False, 'message': 'Користувача не знайдено'}), 404
            
            # Створення нового посту
            new_post = Post(
                title=title,
                content=content,
                user_id=user.id
            )
            db.session.add(new_post)
            db.session.commit()
            
            return jsonify({
                'success': True, 
                'message': 'Пост додано!',
                'post_id': new_post.id
            })
        
        # GET method - отримання списку постів
        posts = Post.query.order_by(Post.date_posted.desc()).all()
        posts_data = []
        for post in posts:
            # Перевіряємо, чи поточний користувач вже лайкнув цей пост
            user_liked = False
            # Перевіряємо, чи користувач є автором посту
            is_author = False
            
            if 'user_id' in session:
                like = Like.query.filter_by(user_id=session['user_id'], post_id=post.id).first()
                user_liked = like is not None
                # Перевіряємо чи поточний користувач є автором посту
                is_author = (session['user_id'] == post.user_id)
                
            # Формування даних про пост для відправки на фронтенд
            posts_data.append({
                'id': post.id,
                'title': post.title,
                'content': post.content,
                'date_posted': post.date_posted.strftime('%d.%m.%Y %H:%M'),
                'author': escape_html(post.author.fullName),
                'author_role': post.author.role,
                'likes': post.likes,
                'user_liked': user_liked,  # Чи вже лайкнув користувач
                'is_author': is_author    # Чи є користувач автором
            })
        return jsonify(posts_data)
    
    except Exception as e:
        return jsonify({'success': False, 'message': 'Помилка сервера'}), 500

@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    """
    API для додавання лайку до посту
    """
    try:
        # Перевірка авторизації
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Увійдіть в систему!'}), 401
        
        user_id = session['user_id']
        post = Post.query.get_or_404(post_id)
        
        # Чи користувач є автором посту
        # Автор не може лайкати власні пости
        if user_id == post.user_id:
            return jsonify({'success': False, 'message': 'Ви не можете лайкати власні пости!'}), 400
        
        # Перевіряємо, чи користувач вже лайкнув цей пост
        existing_like = Like.query.filter_by(user_id=user_id, post_id=post_id).first()
        
        if existing_like:
            return jsonify({'success': False, 'message': 'Ви вже вподобали цей пост!'}), 400
        
        # Додаємо лайк
        new_like = Like(user_id=user_id, post_id=post_id)
        db.session.add(new_like)
        
        # Оновлюємо лічильник лайків
        post.likes += 1
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'likes': post.likes,
            'message': 'Пост вподобано!'
        })
    
    except Exception as e:
        # Відкат транзакції при помилці
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Помилка сервера'}), 500

@app.route('/api/posts/<int:post_id>/unlike', methods=['POST'])
def unlike_post(post_id):
    """
    API для видалення лайку з посту
    """
    try:
        # Перевірка авторизації
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Увійдіть в систему!'}), 401
        
        user_id = session['user_id']
        post = Post.query.get_or_404(post_id)
        
        # НОВА ПЕРЕВІРКА: чи користувач є автором посту
        # Автор не може знімати лайки з власних постів
        if user_id == post.user_id:
            return jsonify({'success': False, 'message': 'Ви не можете знімати лайки з власних постів!'}), 400
        
        # Знаходимо лайк
        like = Like.query.filter_by(user_id=user_id, post_id=post_id).first()
        
        if not like:
            return jsonify({'success': False, 'message': 'Ви ще не вподобали цей пост!'}), 400
        
        # Видаляємо лайк
        db.session.delete(like)
        
        # Оновлюємо лічильник лайків (не менше 0)
        post.likes = max(0, post.likes - 1)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'likes': post.likes,
            'message': 'Лайк видалено!'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Помилка сервера'}), 500

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    """
    API для видалення посту
    Може використовуватись тільки адміністратором 
    """
    try:
        # Перевірка авторизації
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Увійдіть в систему!'}), 401
        
        post = Post.query.get_or_404(post_id)
        current_user = User.query.get(session['user_id'])
        
        # Перевірка прав: тільки адмін або автор може видаляти
        if current_user.role != 'admin' and current_user.id != post.user_id:
            return jsonify({'success': False, 'message': 'Недостатньо прав!'}), 403
        
        # Спочатку видаляємо всі лайки цього поста
        Like.query.filter_by(post_id=post_id).delete()
        
        # Потім видаляємо сам пост
        db.session.delete(post)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Пост видалено!'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': 'Помилка сервера'}), 500

# Обробники помилок
@app.errorhandler(404)
def not_found_error(error):
    """Обробка помилки 404 - сторінка не знайдена"""
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    """Обробка помилки 500 - внутрішня помилка сервера"""
    db.session.rollback()  # Відкат транзакції при помилці
    return render_template('500.html'), 500

@app.errorhandler(403)
def forbidden_error(error):
    """Обробка помилки 403 - доступ заборонено"""
    return render_template('403.html'), 403

if __name__ == '__main__':
    # Запуск додатку в режимі налагодження
    app.run(debug=True)