from flask import Flask, jsonify, render_template, redirect, url_for, flash, session, request, send_file
from datetime import datetime, timedelta
# Импортируем только функции, не вызываем их здесь
from dbinit import check_and_update_schema
import bcrypt
import os
from api.auth import auth_bp
from api.chat import chat_bp
from api.user import user_bp
from api.admin import admin_bp  # Import our new admin blueprint
import sqlite3
from io import BytesIO

# Создаем директории для статических файлов
try:
    os.makedirs('static/images', exist_ok=True)
    os.makedirs('static/uploads', exist_ok=True)
    print(f"Static directories created at: {os.path.abspath('static')}")
except Exception as e:
    print(f"Warning: Could not create directories: {e}")

# Явно инициализируем базу данных перед созданием приложения
print("Initializing database from main.py...")
# Эта функция инициализирует БД при импорте
from dbinit import init_db

# Создаем Flask приложение
app = Flask(__name__, static_folder='static')
app.secret_key = os.urandom(24)  # Для работы с сессиями
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # Сессия живет 7 дней
app.config['SESSION_TYPE'] = 'filesystem'  # Используем файловую систему для хранения сессий
app.config['SESSION_COOKIE_SECURE'] = False  # В production должно быть True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_PERMANENT'] = True

# Обеспечиваем создание файла api/user.py
user_bp_file = 'api/user.py'
if not os.path.exists(user_bp_file):
    print(f"Creating {user_bp_file}")
    with open(user_bp_file, 'w') as f:
        f.write('''
from flask import Blueprint, request, jsonify, session, send_file
import sqlite3
from io import BytesIO
import os

user_bp = Blueprint('user', __name__)

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_user_photo(user_id=None):
    """Get user profile photo"""
    if user_id is None and 'user_id' in session:
        user_id = session['user_id']
    elif user_id is None:
        return None
    
    conn = get_db_connection()
    result = conn.execute('SELECT profile_photo FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    
    if not result or not result['profile_photo']:
        return None
    
    return BytesIO(result['profile_photo'])

@user_bp.route('/api/user/photo', methods=['GET'])
def get_user_photo_route():
    """Get user profile photo"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    user_id = session['user_id']
    photo = get_user_photo(user_id)
    
    if not photo:
        return send_file('static/images/avatar.png', mimetype='image/png')
    
    return send_file(photo, mimetype='image/jpeg')

@user_bp.route('/api/user/photo', methods=['POST'])
def upload_user_photo():
    """Upload user profile photo"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Пользователь не авторизован'}), 401
    
    if 'profile_photo' not in request.files:
        return jsonify({'success': False, 'message': 'Файл не найден'}), 400
    
    photo_file = request.files['profile_photo']
    
    if not photo_file.filename:
        return jsonify({'success': False, 'message': 'Файл не выбран'}), 400
    
    # Считываем данные фотографии
    photo_data = photo_file.read()
    
    # Сохраняем фотографию в базе данных
    conn = get_db_connection()
    conn.execute('UPDATE users SET profile_photo = ? WHERE id = ?', 
                (photo_data, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Фото профиля обновлено'})
''')

# Теперь можем импортировать user_bp
from api.user import user_bp, get_user_photo

# Регистрируем блюпринты
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(admin_bp)  # Register our new admin blueprint

# Проверяем БД перед запуском
# Flag to ensure the logic runs only once
first_request_handled = False

@app.before_request
def before_request():
    """Check database tables and ensure default avatar before the first request"""
    global first_request_handled
    if not first_request_handled:
        print("Checking database schema before first request...")
        check_and_update_schema()
        print("Database schema check complete")
        
        # Ensure default avatar
        avatar_path = os.path.join(app.static_folder, 'images', 'avatar.png')
        if not os.path.exists(avatar_path):
            print(f"Creating default avatar at {avatar_path}")
            try:
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(avatar_path), exist_ok=True)
                
                # Create a simple placeholder avatar
                from PIL import Image, ImageDraw
                img = Image.new('RGB', (200, 200), color=(73, 109, 137))
                d = ImageDraw.Draw(img)
                d.ellipse((50, 50, 150, 150), fill=(255, 255, 255))
                img.save(avatar_path)
                print(f"Default avatar created at {avatar_path}")
            except Exception as e:
                print(f"Failed to create default avatar: {e}")
                try:
                    with open(avatar_path, 'wb') as f:
                        f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n\x0b\xb8\x00\x00\x00\x00IEND\xaeB`\x82')
                    print(f"Empty default avatar created at {avatar_path}")
                except:
                    print("Failed to create empty avatar file")
        first_request_handled = True

@app.route('/ping')
def index():
    return jsonify({"message": "pong"})

@app.route('/')
def home():
    # Проверяем, авторизован ли пользователь
    if 'user_id' in session:
        return redirect(url_for('chat_page'))
    return render_template('index.html')

@app.route('/profile')
def profile():
    # Проверяем, авторизован ли пользователь
    if 'user_id' not in session:
        return redirect(url_for('home'))
    return render_template('profile.html')

@app.route('/chat')
@app.route('/main')
def chat_page():
    # Проверяем, авторизован ли пользователь
    if 'user_id' not in session:
        return redirect(url_for('home'))
    
    # Передаем имя пользователя и timestamp в шаблон
    username = session.get('nickname', 'Пользователь')
    import time
    timestamp = int(time.time())  # Добавляем timestamp для предотвращения кэширования
    return render_template('main.html', username=username, timestamp=timestamp)

@app.route('/get_user_photo')
def get_user_photo_route():
    """Маршрут для получения фото профиля пользователя в шаблонах"""
    if 'user_id' not in session:
        return redirect(url_for('home'))
    return redirect('/api/user/photo')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('nickname', None)
    return redirect(url_for('home'))

@app.route('/api/user/photo')
def user_photo_redirect():
    """Удобная обертка для получения фото пользователя"""
    if 'user_id' not in session:
        return send_file('static/images/avatar.png', mimetype='image/png')
    return redirect('/api/user/photo')

# Admin route handler
@app.route('/admin')
def admin_dashboard():
    # Check if user is logged in
    if 'user_id' not in session:
        return redirect(url_for('home'))

    # Check if user is an admin
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    
    # Debug: Print the user ID trying to access admin
    user_id = session['user_id']
    print(f"Admin access attempt by user ID: {user_id}")
    
    # Check admin status (assuming there's an is_admin column or admin_users table)
    try:
        # First check if the admin field exists in users table
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"Database columns in users table: {columns}")
        
        if 'is_admin' in columns:
            user = conn.execute('SELECT is_admin FROM users WHERE id = ?', 
                               (user_id,)).fetchone()
            is_admin = user and user['is_admin'] == 1
            print(f"User admin status from database: {is_admin}")
        else:
            # If no admin field, grant admin access to user ID 1 (first user)
            is_admin = user_id == 1
            print(f"No is_admin column, granting access based on ID: {is_admin}")
        
        if not is_admin:
            print(f"Access denied: User {user_id} is not an admin")
            return redirect(url_for('home'))
        
        # Get statistics for admin dashboard
        stats = {}
        stats['total_users'] = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']
        
        # Check if last_active column exists before using it
        if 'last_active' in columns:
            # Count active users (active in last 15 minutes)
            import datetime
            fifteen_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=15)).isoformat()
            try:
                stats['active_users'] = conn.execute(
                    'SELECT COUNT(*) as count FROM users WHERE last_active > ?', 
                    (fifteen_mins_ago,)
                ).fetchone()['count']
            except sqlite3.OperationalError:
                # Fallback if the query fails
                stats['active_users'] = 1  # At least the admin is active
        else:
            # If no last_active column, set a default value
            stats['active_users'] = 1  # At least the admin is active
        
        # Count groups
        stats['total_groups'] = conn.execute('SELECT COUNT(*) as count FROM group_chats').fetchone()['count']
        
        # Get recent users, use created_at instead of last_active if needed
        try:
            if 'last_active' in columns:
                recent_users = conn.execute('''
                    SELECT id, nickname, last_active 
                    FROM users 
                    ORDER BY last_active DESC LIMIT 10
                ''').fetchall()
            else:
                recent_users = conn.execute('''
                    SELECT id, nickname, created_at AS last_active
                    FROM users 
                    ORDER BY created_at DESC LIMIT 10
                ''').fetchall()
        except sqlite3.OperationalError:
            # Fallback query if both fail
            recent_users = conn.execute('''
                SELECT id, nickname, '' AS last_active
                FROM users 
                LIMIT 10
            ''').fetchall()
        
        conn.close()
        
        print(f"Admin dashboard successfully rendered for user {user_id}")
        return render_template('admin.html', stats=stats, recent_users=recent_users)
    except Exception as e:
        conn.close()
        print(f"Error in admin access check: {e}")
        return redirect(url_for('home'))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
