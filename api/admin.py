import sqlite3
from flask import Blueprint, request, jsonify, session
from datetime import datetime
from functools import wraps

admin_bp = Blueprint('admin', __name__)

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Check if the user is an admin
def is_admin(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if is_admin column exists
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'is_admin' in columns:
        user = conn.execute('SELECT is_admin FROM users WHERE id = ?', 
                           (user_id,)).fetchone()
        is_admin = user and user['is_admin'] == 1
    else:
        # If no admin field, grant admin access to user ID 1 (first user)
        is_admin = user_id == 1
    
    conn.close()
    return is_admin

# Admin authentication middleware
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"success": False, "message": "Не авторизован"}), 401
            
        user_id = session.get('user_id')
        if not is_admin(user_id):
            return jsonify({"success": False, "message": "Недостаточно прав"}), 403
            
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/api/admin/users', methods=['GET'])
@admin_required
def get_users():
    """Get all users for admin dashboard"""
    conn = get_db_connection()
    
    # Check if is_active column exists
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    
    query = '''
        SELECT id, nickname, email, created_at
        FROM users
        ORDER BY id ASC
    '''
    
    # Add is_active to query if it exists
    if 'is_active' in columns:
        query = '''
            SELECT id, nickname, email, is_active, created_at
            FROM users
            ORDER BY id ASC
        '''
    
    users = conn.execute(query).fetchall()
    
    users_list = []
    for user in users:
        user_data = {
            "id": user['id'],
            "nickname": user['nickname'],
            "email": user['email'] if 'email' in user.keys() else None,
            "created_at": user['created_at']
        }
        
        # Add is_active if it exists
        if 'is_active' in columns:
            user_data["is_active"] = bool(user['is_active']) if 'is_active' in user.keys() else True
        else:
            user_data["is_active"] = True
        
        users_list.append(user_data)
    
    conn.close()
    return jsonify({
        "success": True,
        "users": users_list
    })

@admin_bp.route('/api/admin/groups', methods=['GET'])
@admin_required
def get_groups():
    """Get all groups for admin dashboard"""
    conn = get_db_connection()
    
    try:
        groups = conn.execute('''
            SELECT gc.id, c.chat_name as name, gc.creator_id, u.nickname as creator_name, 
                   c.created_at, COUNT(gm.user_id) as member_count
            FROM group_chats gc
            JOIN chats c ON gc.chat_id = c.id
            JOIN users u ON gc.creator_id = u.id
            LEFT JOIN group_members gm ON gc.id = gm.group_chat_id AND gm.status = 'active'
            GROUP BY gc.id
            ORDER BY c.created_at DESC
        ''').fetchall()
        
        groups_list = []
        for group in groups:
            groups_list.append({
                "id": group['id'],
                "name": group['name'],
                "creator_id": group['creator_id'],
                "creator_name": group['creator_name'],
                "created_at": group['created_at'],
                "member_count": group['member_count']
            })
        
        conn.close()
        return jsonify({
            "success": True,
            "groups": groups_list
        })
    except sqlite3.Error as e:
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Ошибка при получении групп: {str(e)}"
        }), 500

@admin_bp.route('/api/admin/groups/<int:group_id>', methods=['GET'])
@admin_required
def get_group_details(group_id):
    """Get detailed information about a group"""
    conn = get_db_connection()
    
    try:
        # Get group info
        group_info = conn.execute('''
            SELECT gc.id, c.chat_id, c.chat_name as name, gc.description, gc.creator_id,
                   u.nickname as creator_name, c.created_at
            FROM group_chats gc
            JOIN chats c ON gc.chat_id = c.id
            JOIN users u ON gc.creator_id = u.id
            WHERE gc.id = ?
        ''', (group_id,)).fetchone()
        
        if not group_info:
            conn.close()
            return jsonify({"success": False, "message": "Группа не найдена"}), 404
        
        # Get group members
        members = conn.execute('''
            SELECT gm.user_id, u.nickname, 
                   COALESCE(ga.admin_level, 0) as admin_level,
                   gm.joined_at
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            LEFT JOIN group_admins ga ON gm.group_chat_id = ga.group_chat_id AND gm.user_id = ga.user_id
            WHERE gm.group_chat_id = ? AND gm.status = 'active'
            ORDER BY admin_level DESC, nickname ASC
        ''', (group_id,)).fetchall()
        
        members_list = []
        for member in members:
            members_list.append({
                "user_id": member['user_id'],
                "nickname": member['nickname'],
                "admin_level": member['admin_level'],
                "is_admin": member['admin_level'] > 0,
                "is_creator": member['admin_level'] == 2,
                "joined_at": member['joined_at']
            })
        
        # Get recent messages
        messages = conn.execute('''
            SELECT m.id, m.content, m.sender_id, u.nickname as sender_name, m.timestamp
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.timestamp DESC LIMIT 10
        ''', (group_info['chat_id'],)).fetchall()
        
        messages_list = []
        for message in messages:
            messages_list.append({
                "id": message['id'],
                "content": message['content'],
                "sender_id": message['sender_id'],
                "sender_name": message['sender_name'],
                "timestamp": message['timestamp']
            })
        
        conn.close()
        
        return jsonify({
            "success": True,
            "group_info": {
                "id": group_info['id'],
                "name": group_info['name'],
                "description": group_info['description'],
                "creator_id": group_info['creator_id'],
                "creator_name": group_info['creator_name'],
                "created_at": group_info['created_at'],
                "member_count": len(members_list)
            },
            "members": members_list,
            "messages": messages_list
        })
    except sqlite3.Error as e:
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Ошибка при получении информации о группе: {str(e)}"
        }), 500

@admin_bp.route('/api/admin/users/<int:user_id>/toggle_status', methods=['POST'])
@admin_required
def toggle_user_status(user_id):
    """Toggle user active status"""
    data = request.get_json()
    if not data or 'is_active' not in data:
        return jsonify({"success": False, "message": "Отсутствуют данные о статусе"}), 400
    
    is_active = data['is_active']
    
    # Don't allow deactivating yourself
    if user_id == session.get('user_id'):
        return jsonify({"success": False, "message": "Нельзя изменить свой статус"}), 403
    
    conn = get_db_connection()
    
    try:
        # Check if is_active column exists
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'is_active' not in columns:
            # Add is_active column if it doesn't exist
            conn.execute('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1')
        
        conn.execute('UPDATE users SET is_active = ? WHERE id = ?', 
                    (1 if is_active else 0, user_id))
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": f"Статус пользователя успешно изменен на {'активный' if is_active else 'неактивный'}"
        })
    except sqlite3.Error as e:
        conn.rollback()
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Ошибка при изменении статуса: {str(e)}"
        }), 500

@admin_bp.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete or deactivate a user"""
    # Don't allow deleting yourself
    if user_id == session.get('user_id'):
        return jsonify({"success": False, "message": "Нельзя удалить свой аккаунт"}), 403
    
    conn = get_db_connection()
    
    try:
        # Check if is_deleted column exists
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'is_deleted' not in columns:
            # Add is_deleted column if it doesn't exist
            conn.execute('ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0')
        
        # Mark as deleted instead of removing from database
        conn.execute('UPDATE users SET is_deleted = 1 WHERE id = ?', (user_id,))
        
        # Also deactivate user
        if 'is_active' in columns:
            conn.execute('UPDATE users SET is_active = 0 WHERE id = ?', (user_id,))
            
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Пользователь успешно удален"
        })
    except sqlite3.Error as e:
        conn.rollback()
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Ошибка при удалении пользователя: {str(e)}"
        }), 500

@admin_bp.route('/api/admin/groups/<int:group_id>', methods=['DELETE'])
@admin_required
def delete_group(group_id):
    """Delete a group"""
    conn = get_db_connection()
    
    try:
        # Get chat ID for this group
        chat_id_result = conn.execute('SELECT chat_id FROM group_chats WHERE id = ?', 
                                     (group_id,)).fetchone()
        
        if not chat_id_result:
            conn.close()
            return jsonify({"success": False, "message": "Группа не найдена"}), 404
        
        chat_id = chat_id_result['chat_id']
        
        # Check if is_deleted column exists in chats table
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(chats)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'is_deleted' not in columns:
            # Add is_deleted column if it doesn't exist
            conn.execute('ALTER TABLE chats ADD COLUMN is_deleted INTEGER DEFAULT 0')
        
        # Mark all members as removed
        conn.execute('''
            UPDATE group_members 
            SET status = 'removed' 
            WHERE group_chat_id = ?
        ''', (group_id,))
        
        # Mark chat as deleted
        conn.execute('UPDATE chats SET is_deleted = 1 WHERE id = ?', (chat_id,))
        
        # Add system message about deletion by admin
        admin_id = session.get('user_id')
        admin_name = conn.execute('SELECT nickname FROM users WHERE id = ?', 
                                 (admin_id,)).fetchone()['nickname']
        
        conn.execute('''
            INSERT INTO messages (chat_id, sender_id, content)
            VALUES (?, ?, ?)
        ''', (chat_id, admin_id, f"Группа удалена администратором {admin_name}"))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Группа успешно удалена"
        })
    except sqlite3.Error as e:
        conn.rollback()
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Ошибка при удалении группы: {str(e)}"
        }), 500

@admin_bp.route('/api/admin/users/search', methods=['GET'])
@admin_required
def search_users():
    """Search for users by nickname or email"""
    query = request.args.get('query', '').strip()
    
    if not query:
        return jsonify({"success": False, "message": "Поисковый запрос не указан"}), 400
    
    conn = get_db_connection()
    
    try:
        # Check if is_active column exists
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        base_query = '''
            SELECT id, nickname, email, created_at
            FROM users
            WHERE (nickname LIKE ? OR email LIKE ?)
            ORDER BY id ASC
        '''
        
        # Add is_active to query if it exists
        if 'is_active' in columns:
            base_query = '''
                SELECT id, nickname, email, is_active, created_at
                FROM users
                WHERE (nickname LIKE ? OR email LIKE ?)
                ORDER BY id ASC
            '''
        
        users = conn.execute(base_query, (f'%{query}%', f'%{query}%')).fetchall()
        
        users_list = []
        for user in users:
            user_data = {
                "id": user['id'],
                "nickname": user['nickname'],
                "email": user['email'] if 'email' in user.keys() else None,
                "created_at": user['created_at']
            }
            
            # Add is_active if it exists
            if 'is_active' in columns:
                user_data["is_active"] = bool(user['is_active']) if 'is_active' in user.keys() else True
            else:
                user_data["is_active"] = True
            
            users_list.append(user_data)
        
        conn.close()
        
        return jsonify({
            "success": True,
            "users": users_list
        })
    except sqlite3.Error as e:
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Ошибка при поиске пользователей: {str(e)}"
        }), 500

@admin_bp.route('/api/admin/groups/search', methods=['GET'])
@admin_required
def search_groups():
    """Search for groups by name or creator"""
    query = request.args.get('query', '').strip()
    
    if not query:
        return jsonify({"success": False, "message": "Поисковый запрос не указан"}), 400
    
    conn = get_db_connection()
    
    try:
        groups = conn.execute('''
            SELECT gc.id, c.chat_name as name, gc.creator_id, u.nickname as creator_name, 
                   c.created_at, COUNT(gm.user_id) as member_count
            FROM group_chats gc
            JOIN chats c ON gc.chat_id = c.id
            JOIN users u ON gc.creator_id = u.id
            LEFT JOIN group_members gm ON gc.id = gm.group_chat_id AND gm.status = 'active'
            WHERE c.chat_name LIKE ? OR u.nickname LIKE ?
            GROUP BY gc.id
            ORDER BY c.created_at DESC
        ''', (f'%{query}%', f'%{query}%')).fetchall()
        
        groups_list = []
        for group in groups:
            groups_list.append({
                "id": group['id'],
                "name": group['name'],
                "creator_id": group['creator_id'],
                "creator_name": group['creator_name'],
                "created_at": group['created_at'],
                "member_count": group['member_count']
            })
        
        conn.close()
        
        return jsonify({
            "success": True,
            "groups": groups_list
        })
    except sqlite3.Error as e:
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Ошибка при поиске групп: {str(e)}"
        }), 500

@admin_bp.route('/api/admin/stats', methods=['GET'])
@admin_required
def get_admin_stats():
    """Get statistics for admin dashboard"""
    conn = get_db_connection()
    
    try:
        stats = {}
        
        # Total users
        stats['total_users'] = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']
        
        # Check if last_active column exists
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Active users (active in last 15 minutes)
        if 'last_active' in columns:
            import datetime
            fifteen_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=15)).isoformat()
            try:
                stats['active_users'] = conn.execute(
                    'SELECT COUNT(*) as count FROM users WHERE last_active > ?', 
                    (fifteen_mins_ago,)
                ).fetchone()['count']
            except sqlite3.OperationalError:
                stats['active_users'] = 1  # At least the admin is active
        else:
            stats['active_users'] = 1
        
        # Total groups
        stats['total_groups'] = conn.execute('SELECT COUNT(*) as count FROM group_chats').fetchone()['count']
        
        # Total messages
        stats['total_messages'] = conn.execute('SELECT COUNT(*) as count FROM messages').fetchone()['count']
        
        # Messages today
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        stats['messages_today'] = conn.execute(
            'SELECT COUNT(*) as count FROM messages WHERE timestamp LIKE ?', 
            (f'{today}%',)
        ).fetchone()['count']
        
        conn.close()
        
        return jsonify({
            "success": True,
            "stats": stats
        })
    except sqlite3.Error as e:
        conn.close()
        return jsonify({
            "success": False,
            "message": f"Ошибка при получении статистики: {str(e)}"
        }), 500
