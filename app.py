from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date
import os
import hashlib

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-here'

db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True) # Унікальний ідентифікатор користувача
    fullName = db.Column(db.String(100), nullable=False) # Повне ім'я та прізвище користувача
    email = db.Column(db.String(100), unique=True, nullable=False) # Електронна пошта користувача
    phone = db.Column(db.String(20), nullable=False) # Номер телефону користувача
    password = db.Column(db.String(128), nullable=False) # Хешований пароль користувача
    registration_date = db.Column(db.DateTime, default=datetime.utcnow) # Дата та час реєстрації користувача
    role = db.Column(db.String(20), default='user') # Роль користувача: 'user' або 'admin'
    posts = db.relationship('Post', backref='author', lazy=True) # Відношення до постів користувача 

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True) # Унікальний ідентифікатор поста
    title = db.Column(db.String(200), nullable=False) # Заголовок поста
    content = db.Column(db.Text, nullable=False) # Зміст поста
    date_posted = db.Column(db.DateTime, default=datetime.utcnow) # Дата та час публікації поста
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False) # Ідентифікатор автора поста
    likes = db.Column(db.Integer, default=0) # Кількість лайків поста

# Функція для хешування пароля
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# Ініціалізація бази
def init_db():
    with app.app_context():
        db.create_all()
        
        admin = User.query.filter_by(email='dankusnir09@gmail.com').first()
        if not admin:
            admin_user = User(
                fullName='Кушнір Даніїл',
                email='dankusnir09@gmail.com',
                phone='0977138005',
                password=hash_password('admin123'),  # Пароль адміністратора
                role='admin'
            )
            db.session.add(admin_user)
            db.session.commit()
            print("✅ Адміністратор створений!")
            print("📧 Email: dankusnir09@gmail.com")
            print("🔑 Пароль: admin123")

with app.app_context():
    init_db()

# Маршрути
@app.route('/')
def index():
    users = User.query.all()
    today = date.today()
    today_users = User.query.filter(db.func.date(User.registration_date) == today).count()
    
    user_logged_in = 'user_id' in session
    current_user = None
    if user_logged_in:
        current_user = User.query.get(session['user_id'])
    
    return render_template('index.html', 
                         users=users, 
                         today_users=today_users,
                         user_logged_in=user_logged_in,
                         current_user=current_user)

@app.route('/register', methods=['POST'])
def register():
    try:
        fullName = request.form['fullName']
        email = request.form['email']
        phone = request.form['phone']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        
        # Перевірка паролів
        if password != confirm_password:
            flash('Паролі не співпадають!')
            return redirect('/')
        
        if len(password) < 6:
            flash('Пароль має бути не менше 6 символів!')
            return redirect('/')
        
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Користувач з таким email вже існує! Увійдіть в систему.')
            return redirect('/')
        
        # Завжди створюємо тільки звичайних користувачів
        role = 'user'
        
        # Адміністратор може бути тільки один
        existing_admin = User.query.filter_by(role='admin').first()
        if email == 'dankusnir09@gmail.com' and existing_admin:
            flash('Адміністратор вже існує! Будь ласка, використовуйте інший email.')
            return redirect('/')
        
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
        
        flash('Реєстрація успішна! Ви автоматично увійшли в систему.')
        return redirect('/')
    except Exception as e:
        flash('Помилка реєстрації: ' + str(e))
        return redirect('/')

@app.route('/login', methods=['POST'])
def login():
    try:
        email = request.form['email']
        password = request.form['password']
        
        user = User.query.filter_by(email=email).first()
        if user and user.password == hash_password(password):
            session['user_id'] = user.id
            session['user_email'] = user.email
            flash(f'Вітаємо, {user.fullName}! Ви успішно увійшли.')
        else:
            flash('Невірний email або пароль!')
        
        return redirect('/')
    except Exception as e:
        flash('Помилка входу: ' + str(e))
        return redirect('/')

@app.route('/logout')
def logout():
    session.clear()
    flash('Ви вийшли з системи.')
    return redirect('/')

@app.route('/newsfeed')
def newsfeed():
    if 'user_id' not in session:
        flash('Будь ласка, увійдіть в систему для перегляду стрічки.')
        return redirect('/')
    
    # ✅ ВИПРАВЛЕНА ЛІНІЯ - використовуємо .get()
    current_user = User.query.get(session.get('user_id'))
    return render_template('newsfeed.html', current_user=current_user)

# Решта API маршрутів залишаються незмінними...
@app.route('/api/users')
def get_users():
    users = User.query.all()
    users_data = []
    for user in users:
        users_data.append({
            'id': user.id,
            'fullName': user.fullName,
            'email': user.email,
            'phone': user.phone,
            'role': user.role,
            'registration_date': user.registration_date.strftime('%d.%m.%Y %H:%M')
        })
    return jsonify(users_data)

@app.route('/api/posts', methods=['GET', 'POST'])
def handle_posts():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Увійдіть в систему!'})

    if request.method == 'POST':
        data = request.json
        
        # Тепер кожен зареєстрований користувач може створювати пости
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'Помилка сесії'})
        user = User.query.get(user_id)
        
        new_post = Post(
            title=data['title'],
            content=data['content'],
            user_id=user.id
        )
        db.session.add(new_post)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Пост додано!'})
    
    posts = Post.query.order_by(Post.date_posted.desc()).all()
    posts_data = []
    for post in posts:
        posts_data.append({
            'id': post.id,
            'title': post.title,
            'content': post.content,
            'date_posted': post.date_posted.strftime('%d.%m.%Y %H:%M'),
            'author': post.author.fullName,
            'author_role': post.author.role,
            'likes': post.likes
        })
    return jsonify(posts_data)

@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    post = Post.query.get_or_404(post_id)
    post.likes += 1
    db.session.commit()
    return jsonify({'success': True, 'likes': post.likes})

if __name__ == '__main__':
    app.run(debug=True)