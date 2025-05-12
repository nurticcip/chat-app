/**
 * Функционал для административной панели
 */

document.addEventListener('DOMContentLoaded', function() {
    // Загрузка данных для управления пользователями
    function loadUserData() {
        const usersContent = document.getElementById('users-content');
        if (!usersContent) return;
        
        usersContent.classList.add('loading');
        usersContent.textContent = 'Загрузка данных пользователей...';
        
        fetch('/api/admin/users')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderUserData(data.users);
                } else {
                    usersContent.classList.remove('loading');
                    usersContent.innerHTML = `<div class="error-message">Ошибка: ${data.message}</div>`;
                }
            })
            .catch(error => {
                usersContent.classList.remove('loading');
                usersContent.innerHTML = `<div class="error-message">Ошибка загрузки: ${error.message}</div>`;
            });
    }
    
    // Отрисовка таблицы пользователей
    function renderUserData(users) {
        const usersContent = document.getElementById('users-content');
        usersContent.classList.remove('loading');
        
        if (!users || users.length === 0) {
            usersContent.innerHTML = '<div class="info-message">Нет данных о пользователях</div>';
            return;
        }
        
        let html = `
            <div class="admin-toolbar">
                <button id="add-user-btn" class="admin-btn"><i class="fas fa-plus"></i> Добавить пользователя</button>
                <div class="admin-search">
                    <input type="text" placeholder="Поиск пользователя..." id="user-search">
                    <button id="search-btn"><i class="fas fa-search"></i></button>
                </div>
            </div>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Имя пользователя</th>
                            <th>Email</th>
                            <th>Статус</th>
                            <th>Регистрация</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        users.forEach(user => {
            html += `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.nickname}</td>
                    <td>${user.email || 'Не указан'}</td>
                    <td>${user.is_active ? '<span class="status-active">Активен</span>' : '<span class="status-inactive">Неактивен</span>'}</td>
                    <td>${formatDate(user.created_at)}</td>
                    <td class="actions">
                        <button class="action-btn edit-btn" data-id="${user.id}" title="Редактировать"><i class="fas fa-edit"></i></button>
                        <button class="action-btn ${user.is_active ? 'disable-btn' : 'enable-btn'}" data-id="${user.id}" 
                                title="${user.is_active ? 'Заблокировать' : 'Разблокировать'}">
                            <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                        </button>
                        <button class="action-btn delete-btn" data-id="${user.id}" title="Удалить"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        usersContent.innerHTML = html;
        
        // Добавляем обработчики событий
        setupUserEventHandlers();
    }
    
    // Загрузка данных для управления группами
    function loadGroupData() {
        const groupsContent = document.getElementById('groups-content');
        if (!groupsContent) return;
        
        groupsContent.classList.add('loading');
        groupsContent.textContent = 'Загрузка данных групп...';
        
        fetch('/api/admin/groups')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderGroupData(data.groups);
                } else {
                    groupsContent.classList.remove('loading');
                    groupsContent.innerHTML = `<div class="error-message">Ошибка: ${data.message}</div>`;
                }
            })
            .catch(error => {
                groupsContent.classList.remove('loading');
                groupsContent.innerHTML = `<div class="error-message">Ошибка загрузки: ${error.message}</div>`;
            });
    }
    
    // Отрисовка таблицы групп
    function renderGroupData(groups) {
        const groupsContent = document.getElementById('groups-content');
        groupsContent.classList.remove('loading');
        
        if (!groups || groups.length === 0) {
            groupsContent.innerHTML = '<div class="info-message">Нет данных о группах</div>';
            return;
        }
        
        let html = `
            <div class="admin-toolbar">
                <div class="admin-search">
                    <input type="text" placeholder="Поиск группы..." id="group-search">
                    <button id="group-search-btn"><i class="fas fa-search"></i></button>
                </div>
            </div>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Название</th>
                            <th>Создатель</th>
                            <th>Участники</th>
                            <th>Создана</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        groups.forEach(group => {
            html += `
                <tr>
                    <td>${group.id}</td>
                    <td>${group.name}</td>
                    <td>${group.creator_name}</td>
                    <td>${group.member_count}</td>
                    <td>${formatDate(group.created_at)}</td>
                    <td class="actions">
                        <button class="action-btn view-btn" data-id="${group.id}" title="Просмотр"><i class="fas fa-eye"></i></button>
                        <button class="action-btn delete-btn" data-id="${group.id}" title="Удалить"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        groupsContent.innerHTML = html;
        
        // Добавляем обработчики событий
        setupGroupEventHandlers();
    }
    
    // Настройка обработчиков событий для пользовательского интерфейса
    function setupUserEventHandlers() {
        // Кнопка добавления пользователя
        const addUserBtn = document.getElementById('add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                showAddUserModal();
            });
        }
        
        // Поиск пользователей
        const searchBtn = document.getElementById('search-btn');
        const userSearch = document.getElementById('user-search');
        if (searchBtn && userSearch) {
            searchBtn.addEventListener('click', () => {
                const query = userSearch.value.trim();
                if (query) {
                    searchUsers(query);
                } else {
                    loadUserData(); // Если запрос пустой, загружаем всех пользователей
                }
            });
            
            userSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchBtn.click();
                }
            });
        }
        
        // Кнопки действий в таблице
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = this.dataset.id;
                // Логика редактирования пользователя
                alert(`Редактирование пользователя ID: ${userId}`);
            });
        });
        
        document.querySelectorAll('.disable-btn, .enable-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = this.dataset.id;
                const isActive = this.classList.contains('disable-btn');
                
                if (confirm(`Вы действительно хотите ${isActive ? 'заблокировать' : 'разблокировать'} пользователя?`)) {
                    toggleUserStatus(userId, !isActive);
                }
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = this.dataset.id;
                
                if (confirm('Вы действительно хотите удалить пользователя? Это действие нельзя отменить.')) {
                    deleteUser(userId);
                }
            });
        });
    }
    
    // Настройка обработчиков событий для интерфейса групп
    function setupGroupEventHandlers() {
        // Поиск групп
        const searchBtn = document.getElementById('group-search-btn');
        const groupSearch = document.getElementById('group-search');
        if (searchBtn && groupSearch) {
            searchBtn.addEventListener('click', () => {
                const query = groupSearch.value.trim();
                if (query) {
                    searchGroups(query);
                } else {
                    loadGroupData();
                }
            });
            
            groupSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchBtn.click();
                }
            });
        }
        
        // Просмотр группы
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const groupId = this.dataset.id;
                viewGroupDetails(groupId);
            });
        });
        
        // Удаление группы
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const groupId = this.dataset.id;
                
                if (confirm('Вы действительно хотите удалить группу? Это действие нельзя отменить.')) {
                    deleteGroup(groupId);
                }
            });
        });
    }
    
    // Показать модальное окно добавления пользователя
    function showAddUserModal() {
        let modal = document.getElementById('add-user-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'add-user-modal';
            modal.className = 'admin-modal';
            modal.innerHTML = `
                <div class="admin-modal-content">
                    <div class="admin-modal-header">
                        <h3>Добавить нового пользователя</h3>
                        <span class="admin-modal-close">&times;</span>
                    </div>
                    <div class="admin-modal-body">
                        <form id="add-user-form">
                            <div class="form-group">
                                <label for="user-nickname">Имя пользователя</label>
                                <input type="text" id="user-nickname" name="nickname" required>
                            </div>
                            <div class="form-group">
                                <label for="user-email">Email</label>
                                <input type="email" id="user-email" name="email" required>
                            </div>
                            <div class="form-group">
                                <label for="user-password">Пароль</label>
                                <input type="password" id="user-password" name="password" required>
                            </div>
                            <div class="form-group">
                                <label for="user-password-confirm">Подтверждение пароля</label>
                                <input type="password" id="user-password-confirm" name="password_confirm" required>
                            </div>
                            <div class="form-group checkbox-group">
                                <input type="checkbox" id="user-is-active" name="is_active" checked>
                                <label for="user-is-active">Активный пользователь</label>
                            </div>
                            <div class="form-message" id="add-user-message"></div>
                        </form>
                    </div>
                    <div class="admin-modal-footer">
                        <button type="button" class="admin-btn" id="add-user-submit">Добавить</button>
                        <button type="button" class="admin-btn cancel-btn" id="add-user-cancel">Отмена</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            const closeBtn = modal.querySelector('.admin-modal-close');
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            const cancelBtn = modal.querySelector('#add-user-cancel');
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            const submitBtn = modal.querySelector('#add-user-submit');
            submitBtn.addEventListener('click', () => {
                const form = document.getElementById('add-user-form');
                if (validateUserForm()) {
                    createNewUser();
                }
            });
            
            window.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        modal.style.display = 'block';
        document.getElementById('add-user-form').reset();
        document.getElementById('add-user-message').textContent = '';
    }
    
    // Валидация формы пользователя
    function validateUserForm() {
        const nickname = document.getElementById('user-nickname').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const password = document.getElementById('user-password').value;
        const passwordConfirm = document.getElementById('user-password-confirm').value;
        const messageElem = document.getElementById('add-user-message');
        
        messageElem.textContent = '';
        messageElem.className = 'form-message';
        
        if (nickname.length < 3) {
            messageElem.textContent = 'Имя пользователя должно содержать не менее 3 символов';
            messageElem.className = 'form-message error';
            return false;
        }
        
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            messageElem.textContent = 'Пожалуйста, введите корректный email';
            messageElem.className = 'form-message error';
            return false;
        }
        
        if (password.length < 8) {
            messageElem.textContent = 'Пароль должен содержать не менее 8 символов';
            messageElem.className = 'form-message error';
            return false;
        }
        
        if (password !== passwordConfirm) {
            messageElem.textContent = 'Пароли не совпадают';
            messageElem.className = 'form-message error';
            return false;
        }
        
        return true;
    }
    
    // Создание нового пользователя
    function createNewUser() {
        const nickname = document.getElementById('user-nickname').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const password = document.getElementById('user-password').value;
        const isActive = document.getElementById('user-is-active').checked;
        const messageElem = document.getElementById('add-user-message');
        
        const submitBtn = document.getElementById('add-user-submit');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
        
        fetch('/api/admin/users/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nickname,
                email,
                password,
                is_active: isActive
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                messageElem.textContent = 'Пользователь успешно создан';
                messageElem.className = 'form-message success';
                
                setTimeout(() => {
                    document.getElementById('add-user-modal').style.display = 'none';
                    loadUserData();
                }, 1000);
            } else {
                messageElem.textContent = data.message || 'Ошибка при создании пользователя';
                messageElem.className = 'form-message error';
            }
        })
        .catch(error => {
            messageElem.textContent = 'Произошла ошибка: ' + error.message;
            messageElem.className = 'form-message error';
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        });
    }
    
    // Поиск пользователей
    function searchUsers(query) {
        const usersContent = document.getElementById('users-content');
        if (!usersContent) return;
        
        usersContent.classList.add('loading');
        
        fetch(`/api/admin/users/search?query=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderUserData(data.users);
                } else {
                    usersContent.classList.remove('loading');
                    usersContent.innerHTML = `<div class="error-message">Ошибка: ${data.message}</div>`;
                }
            })
            .catch(error => {
                usersContent.classList.remove('loading');
                usersContent.innerHTML = `<div class="error-message">Ошибка поиска: ${error.message}</div>`;
            });
    }
    
    // Изменение статуса пользователя
    function toggleUserStatus(userId, makeActive) {
        fetch(`/api/admin/users/${userId}/toggle_status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                is_active: makeActive
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadUserData();
            } else {
                alert(`Ошибка: ${data.message}`);
            }
        })
        .catch(error => {
            alert(`Произошла ошибка: ${error.message}`);
        });
    }
    
    // Удаление пользователя
    function deleteUser(userId) {
        fetch(`/api/admin/users/${userId}/delete`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadUserData();
            } else {
                alert(`Ошибка: ${data.message}`);
            }
        })
        .catch(error => {
            alert(`Произошла ошибка: ${error.message}`);
        });
    }
    
    // Поиск групп
    function searchGroups(query) {
        const groupsContent = document.getElementById('groups-content');
        if (!groupsContent) return;
        
        groupsContent.classList.add('loading');
        
        fetch(`/api/admin/groups/search?query=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderGroupData(data.groups);
                } else {
                    groupsContent.classList.remove('loading');
                    groupsContent.innerHTML = `<div class="error-message">Ошибка: ${data.message}</div>`;
                }
            })
            .catch(error => {
                groupsContent.classList.remove('loading');
                groupsContent.innerHTML = `<div class="error-message">Ошибка поиска: ${error.message}</div>`;
            });
    }
    
    // Просмотр деталей группы
    function viewGroupDetails(groupId) {
        window.location.href = `/admin/groups/${groupId}`;
    }
    
    // Удаление группы
    function deleteGroup(groupId) {
        fetch(`/api/admin/groups/${groupId}/delete`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadGroupData();
            } else {
                alert(`Ошибка: ${data.message}`);
            }
        })
        .catch(error => {
            alert(`Произошла ошибка: ${error.message}`);
        });
    }
    
    // Функция форматирования даты
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    
    // Загрузка данных при нажатии на пункты меню
    document.querySelectorAll('.admin-nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#users') {
                loadUserData();
            } else if (this.getAttribute('href') === '#groups') {
                loadGroupData();
            }
        });
    });
});
