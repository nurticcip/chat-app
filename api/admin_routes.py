import sqlite3
import bcrypt
from flask import Blueprint, request, jsonify, session

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@admin_bp.before_request
def check_admin():
    """Check if the user is an admin before allowing access to admin routes"""
    # Skip this check for search routes which might be used on other pages
    if request.endpoint and 'search' not in request.endpoint:
        if 'user_id' not in session:
            return jsonify({"success": False, "message": "Unauthorized"}), 401
        
        conn = get_db_connection()
        user = conn.execute('SELECT is_admin FROM users WHERE id = ?', 
                          (session['user_id'],)).fetchone()
        conn.close()
        
        if not user or not user['is_admin']:
            return jsonify({"success": False, "message": "Unauthorized"}), 403

@admin_bp.route('/users', methods=['GET'])
def get_users():
    """Get all users"""
    conn = get_db_connection()
    users = conn.execute('SELECT id, nickname, email, is_active, created_at FROM users').fetchall()
    conn.close()
    
    users_list = [dict(user) for user in users]
    return jsonify({"success": True, "users": users_list})

@admin_bp.route('/users/search', methods=['GET'])
def search_users():
    """Search users by nickname or email"""
    query = request.args.get('query', '')
    if not query:
        return jsonify({"success": False, "message": "Query parameter is required"}), 400
    
    conn = get_db_connection()
    users = conn.execute(
        'SELECT id, nickname, email, is_active, created_at FROM users WHERE nickname LIKE ? OR email LIKE ?',
        (f'%{query}%', f'%{query}%')
    ).fetchall()
    conn.close()
    
    users_list = [dict(user) for user in users]
    return jsonify({"success": True, "users": users_list})

@admin_bp.route('/users/create', methods=['POST'])
def create_user():
    """Create a new user"""
    data = request.get_json()
    
    if not data:
        return jsonify({"success": False, "message": "No data provided"}), 400
    
    # Check required fields
    required_fields = ['nickname', 'email', 'password']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({"success": False, "message": f"Field {field} is required"}), 400
    
    nickname = data['nickname']
    email = data['email']
    password = data['password']
    is_active = data.get('is_active', True)
    
    # Check password length
    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters long"}), 400
    
    # Check if user with this nickname or email already exists
    conn = get_db_connection()
    existing_user = conn.execute('SELECT id FROM users WHERE nickname = ? OR email = ?', 
                                (nickname, email)).fetchone()
    
    if existing_user:
        conn.close()
        return jsonify({"success": False, "message": "User with this nickname or email already exists"}), 409
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create user
    try:
        conn.execute(
            'INSERT INTO users (nickname, email, password, is_active, is_verified) VALUES (?, ?, ?, ?, ?)',
            (nickname, email, hashed_password, 1 if is_active else 0, 1)  # Admin-created users are verified by default
        )
        conn.commit()
        user_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        conn.close()
        
        return jsonify({
            "success": True, 
            "message": "User created successfully",
            "user_id": user_id
        })
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "message": f"Error creating user: {str(e)}"}), 500

@admin_bp.route('/users/<int:user_id>/toggle_status', methods=['POST'])
def toggle_user_status(user_id):
    """Toggle user active status"""
    data = request.get_json()
    if not data or 'is_active' not in data:
        return jsonify({"success": False, "message": "is_active field is required"}), 400
    
    is_active = data['is_active']
    
    conn = get_db_connection()
    try:
        conn.execute(
            'UPDATE users SET is_active = ? WHERE id = ?',
            (1 if is_active else 0, user_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "User status updated"})
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "message": f"Error updating user status: {str(e)}"}), 500

@admin_bp.route('/users/<int:user_id>/delete', methods=['POST'])
def delete_user(user_id):
    """Delete a user"""
    conn = get_db_connection()
    try:
        # First check if this is not the last admin user
        if user_id == session['user_id']:
            admin_count = conn.execute('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').fetchone()['count']
            if admin_count <= 1:
                conn.close()
                return jsonify({"success": False, "message": "Cannot delete the last admin user"}), 400
        
        conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "User deleted"})
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "message": f"Error deleting user: {str(e)}"}), 500
