from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date
import os
import hashlib
import html
import re

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')

db = SQLAlchemy(app)

# --- MODELS ----------------------------------------------------------------------------------------

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fullName = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    password = db.Column(db.String(128), nullable=False)
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)
    role = db.Column(db.String(20), default='user')
    posts = db.relationship('Post', backref='author', lazy=True)
    likes = db.relationship('Like', backref='user', lazy=True)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    date_posted = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    likes = db.Column(db.Integer, default=0)
    post_likes = db.relationship('Like', backref='post', lazy=True)

class Like(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Унікальний обмежувач - один користувач може лайкнути пост тільки один раз
    __table_args__ = (db.UniqueConstraint('user_id', 'post_id', name='_user_post_uc'),)

# --- FUNCTIONS ----------------------------------------------------------------------------------

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def escape_html(text):
    return html.escape(str(text))

def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    pattern = r'^\+?[0-9\s\-\(\)]{10,}$'
    return re.match(pattern, phone) is not None

def init_db():
    with app.app_context():
        db.create_all()
        
        admin = User.query.filter_by(email='dankusnir09@gmail.com').first()
        if not admin:
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

with app.app_context():
    init_db()

# --- ROUTES --------------------------------------------------------------------------------------

# LOGON

@app.route('/register', methods=['POST'])
def register():
    try:
        # Якщо користувач вже увійшов, перенаправляємо на головну
        if 'user_id' in session:
            return redirect('/home')
            
        fullName = escape_html(request.form['fullName'].strip())
        email = request.form['email'].strip().lower()
        phone = request.form['phone'].strip()
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        
        if not all([fullName, email, phone, password, confirm_password]):
            flash('Будь ласка, заповніть всі обов\'язкові поля!')
            return redirect('/index')
        
        if len(fullName) < 2 or len(fullName) > 100:
            flash('Ім\'я та прізвище має містити від 2 до 100 символів!')
            return redirect('/index')
        
        if not validate_email(email):
            flash('Будь ласка, введіть коректний email!')
            return redirect('/index')
        
        if not validate_phone(phone):
            flash('Будь ласка, введіть коректний номер телефону!')
            return redirect('/index')
        
        if password != confirm_password:
            flash('Паролі не співпадають!')
            return redirect('/index')
        
        if len(password) < 6:
            flash('Пароль має бути не менше 6 символів!')
            return redirect('/index')
        
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Користувач з таким email вже існує! Увійдіть в систему.')
            return redirect('/index')
        
        role = 'user'
        
        existing_admin = User.query.filter_by(role='admin').first()
        if email == 'dankusnir09@gmail.com' and existing_admin:
            flash('Адміністратор вже існує! Будь ласка, використовуйте інший email.')
            return redirect('/index')
        
        new_user = User(
            fullName=fullName, 
            email=email, 
            phone=phone, 
            password=hash_password(password),
            role=role
        )
        db.session.add(new_user)
        db.session.commit()
        
        session['user_id'] = new_user.id
        session['user_email'] = new_user.email
        session['user_role'] = new_user.role
        
        flash('Реєстрація успішна! Ви автоматично увійшли в систему.')
        return redirect('/home')
    except Exception as e:
        flash('Помилка реєстрації: ' + str(e))
        return redirect('/index')

@app.route('/login', methods=['POST'])
def login():
    try:
        # Якщо користувач вже увійшов, перенаправляємо на головну
        if 'user_id' in session:
            return redirect('/home')
            
        email = request.form['email'].strip().lower()
        password = request.form['password']
        
        if not email or not password:
            flash('Будь ласка, заповніть всі поля!')
            return redirect('/index')
        
        user = User.query.filter_by(email=email).first()
        if user and user.password == hash_password(password):
            session['user_id'] = user.id
            session['user_email'] = user.email
            session['user_role'] = user.role
            flash(f'Вітаємо, {user.fullName}! Ви успішно увійшли.')
            return redirect('/home')
        else:
            flash('Невірний email або пароль!')
            return redirect('/index')
        
    except Exception as e:
        flash('Помилка входу: ' + str(e))
        return redirect('/index')

@app.route('/logout')
def logout():
    session.clear()
    flash('Ви вийшли з системи.')
    return redirect('/index')

# Головна сторінка (home)
@app.route('/')
@app.route('/home')
def home():
    if 'user_id' not in session:
        return redirect('/index')
    
    users = User.query.all()
    today = date.today()
    today_users = User.query.filter(db.func.date(User.registration_date) == today).count()
    
    current_user = User.query.get(session['user_id'])
    
    return render_template('home.html', 
                         users=users, 
                         today_users=today_users,
                         current_user=current_user)

# Сторінка реєстрації та входу
@app.route('/index')
def index():
    # Якщо користувач вже увійшов, перенаправляємо на головну
    if 'user_id' in session:
        return redirect('/home')
    
    return render_template('index.html')

@app.route('/newsfeed')
def newsfeed():
    if 'user_id' not in session:
        flash('Будь ласка, увійдіть в систему для перегляду стрічки.')
        return redirect('/index')
    
    current_user = User.query.get(session.get('user_id'))
    if not current_user:
        session.clear()
        flash('Сесія закінчилася. Будь ласка, увійдіть знову.')
        return redirect('/index')
    
    return render_template('newsfeed.html', current_user=current_user)

# --------------------------------------------------------------------------------------------
# API маршрути

@app.route('/api/users')
def get_users():
    try:
        users = User.query.all()
        users_data = []
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
        return jsonify({'error': 'Помилка сервера'}), 500

@app.route('/api/posts', methods=['GET', 'POST'])
def handle_posts():
    try:
        if request.method == 'POST':
            if 'user_id' not in session:
                return jsonify({'success': False, 'message': 'Увійдіть в систему!'}), 401
            
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'message': 'Невірний формат даних'}), 400
            
            title = escape_html(data.get('title', '').strip())
            content = escape_html(data.get('content', '').strip())
            
            if not title or not content:
                return jsonify({'success': False, 'message': 'Заголовок та зміст обов\'язкові'}), 400
            
            if len(title) > 200:
                return jsonify({'success': False, 'message': 'Заголовок занадто довгий'}), 400
            
            user_id = session.get('user_id')
            user = User.query.get(user_id)
            if not user:
                return jsonify({'success': False, 'message': 'Користувача не знайдено'}), 404
            
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
        
        # GET method - ТЕПЕР З ПЕРЕВІРКОЮ ЛАЙКУ
        posts = Post.query.order_by(Post.date_posted.desc()).all()
        posts_data = []
        for post in posts:
            # Перевіряємо, чи поточний користувач вже лайкнув цей пост
            user_liked = False
            if 'user_id' in session:
                like = Like.query.filter_by(user_id=session['user_id'], post_id=post.id).first()
                user_liked = like is not None
                
            posts_data.append({
                'id': post.id,
                'title': post.title,
                'content': post.content,
                'date_posted': post.date_posted.strftime('%d.%m.%Y %H:%M'),
                'author': escape_html(post.author.fullName),
                'author_role': post.author.role,
                'likes': post.likes,
                'user_liked': user_liked  # Додаємо інформацію про лайк користувача
            })
        return jsonify(posts_data)
    
    except Exception as e:
        return jsonify({'success': False, 'message': 'Помилка сервера'}), 500

@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Увійдіть в систему!'}), 401
        
        user_id = session['user_id']
        post = Post.query.get_or_404(post_id)
        
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
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Помилка сервера'}), 500

@app.route('/api/posts/<int:post_id>/unlike', methods=['POST'])
def unlike_post(post_id):
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Увійдіть в систему!'}), 401
        
        user_id = session['user_id']
        post = Post.query.get_or_404(post_id)
        
        # Знаходимо лайк
        like = Like.query.filter_by(user_id=user_id, post_id=post_id).first()
        
        if not like:
            return jsonify({'success': False, 'message': 'Ви ще не вподобали цей пост!'}), 400
        
        # Видаляємо лайк
        db.session.delete(like)
        
        # Оновлюємо лічильник лайків
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
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Увійдіть в систему!'}), 401
        
        post = Post.query.get_or_404(post_id)
        current_user = User.query.get(session['user_id'])
        
        if current_user.role != 'admin':
            return jsonify({'success': False, 'message': 'Недостатньо прав!'}), 403
        
        # Спочатку видаляємо всі лайки цього поста
        Like.query.filter_by(post_id=post_id).delete()
        
        # Потім видаляємо сам пост
        db.session.delete(post)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Пост видалено!'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': 'Помилка сервера'}), 500

@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('500.html'), 500

@app.errorhandler(403)
def forbidden_error(error):
    return render_template('403.html'), 403

if __name__ == '__main__':
    app.run(debug=True)