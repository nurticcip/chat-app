/**
 * Функционал для работы с чатами и сообщениями
 */

// Глобальные переменные для отслеживания состояния
let chatUpdateInterval;
let chatListUpdateInterval;
let activeChatlUpdateInterval;
let currentChatId = null;
let currentChatType = null;
let currentGroupId = null;
let isCurrentUserAdmin = false;
let currentGroupMembers = [];
let lastMessageId = null;
let lastUpdateTime = null;
let cachedChats = [];
let isFirstLoad = true;
let isUpdatingChats = false;
let isUpdatingMessages = false;
let lastUserActivity = Date.now();


// Тестирование библиотеки перевода
document.addEventListener('DOMContentLoaded', function() {
    console.log("Проверяем библиотеку перевода...");
    setTimeout(() => {
        if (typeof translate !== 'undefined') {
            translate("Hello world", { to: 'ru' })
                .then(result => {
                    console.log("Тест перевода:", result);
                })
                .catch(error => {
                    console.error("Ошибка тестового перевода:", error);
                });
        } else {
            console.error("Библиотека перевода не загружена!");
        }
    }, 1000);
});
// Инициализация компонента чата
function initChatComponent() {
    console.log("Инициализация компонента чата...");
    
    // Запускаем обновление списка чатов
    startChatUpdates();
    
    // Отслеживание активности пользователя
    document.addEventListener('mousemove', updateUserActivity);
    document.addEventListener('keypress', updateUserActivity);
    document.addEventListener('click', updateUserActivity);
    document.addEventListener('touchstart', updateUserActivity);
    
    // Проверка активности пользователя каждые 30 секунд
    setInterval(checkUserActivity, 30000);
    
    // Обработчик для кнопки отправки сообщения
    const sendMessageBtn = document.getElementById('send-message-btn');
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }
    
    // Обработчик для поля ввода сообщения (отправка по Enter)
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Кнопка прикрепления файла
    const attachFileBtn = document.getElementById('attach-file');
    if (attachFileBtn) {
        attachFileBtn.addEventListener('click', function() {
            document.getElementById('file-input').click();
        });
    }
    
    // Обработка выбранного файла
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleSelectedFile);
    }
    
    // Обработка нажатия на кнопку "назад" в чате
    const backToChatsBtn = document.getElementById('back-to-chats');
    if (backToChatsBtn) {
        backToChatsBtn.addEventListener('click', function() {
            hideChat();
            showMainContent();
        });
    }
    
    // Обработчик клика на аватар чата (для управления группой)
    const chatAvatar = document.getElementById('chat-avatar');
    if (chatAvatar) {
        chatAvatar.addEventListener('click', function() {
            if (currentChatType === 'group' && currentGroupId) {
                openGroupInfoModal(currentGroupId);
            }
        });
    }
    
    // Инициализация модального окна информации о группе
    initGroupInfoModal();
}

// Запуск периодического обновления чатов
function startChatUpdates() {
    // Обновляем список чатов сразу при запуске
    updateChatsList();
    
    // Устанавливаем интервал обновления для списка чатов - более частое обновление (1 секунда)
    chatListUpdateInterval = setInterval(updateChatsList, 1000);
    
    // Обрабатываем случай, когда пользователь уходит со страницы
    window.addEventListener('beforeunload', function() {
        if (chatListUpdateInterval) clearInterval(chatListUpdateInterval);
        if (activeChatlUpdateInterval) clearInterval(activeChatlUpdateInterval);
    });
    
    // Добавляем обработчик для видимости вкладки
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            // Страница стала видимой - немедленно обновляем данные
            updateChatsList();
            if (currentChatId) {
                // При возвращении на страницу делаем полную перезагрузку сообщений
                loadChatMessages(currentChatId);
            }
        }
    });
}

// Обновление списка чатов
async function updateChatsList() {
    // Предотвращаем параллельные запросы
    if (isUpdatingChats) return;
    isUpdatingChats = true;
    
    try {
        const response = await fetch('/api/chats');
        if (!response.ok) {
            throw new Error('Ошибка загрузки чатов');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Сравниваем с предыдущим состоянием, чтобы предотвратить ненужные обновления DOM
            if (isFirstLoad || hasChatsChanged(cachedChats, data.chats)) {
                renderChatsList(data.chats);
                cachedChats = data.chats;
                isFirstLoad = false;
            }
            
            // Если открыт какой-то чат, обновляем его содержимое
            if (currentChatId) {
                updateCurrentChatMessages();
            }
        } else {
            console.error('Ошибка при загрузке чатов:', data.message);
        }
    } catch (error) {
        console.error('Ошибка при обновлении чатов:', error);
    } finally {
        isUpdatingChats = false;
    }
}

// Проверка изменений в списке чатов
function hasChatsChanged(oldChats, newChats) {
    if (oldChats.length !== newChats.length) return true;
    
    // Проверяем изменения в последнем сообщении или времени
    for (let i = 0; i < newChats.length; i++) {
        const oldChat = oldChats.find(c => c.id === newChats[i].id);
        if (!oldChat) return true;
        
        // Сравниваем последнее сообщение и время
        if (oldChat.last_message !== newChats[i].last_message ||
            oldChat.last_message_time !== newChats[i].last_message_time) {
            return true;
        }
    }
    
    return false;
}

// Отрисовка списка чатов в интерфейсе
function renderChatsList(chats) {
    const chatListContainer = document.querySelector('.chat-list');
    if (!chatListContainer) return;
    
    if (chats.length === 0) {
        chatListContainer.innerHTML = `<div class="no-chats">Нет активных чатов</div>`;
        return;
    }
    
    let chatsHTML = '';
    
    chats.forEach(chat => {
        // Форматируем время последнего сообщения
        const lastMessageTime = chat.last_message_time ? formatMessageTime(new Date(chat.last_message_time)) : '';
        
        // Определяем иконку для чата (группа или диалог)
        const chatIcon = chat.type === 'group' ? '👥' : '👤';
        
        // Определяем URL аватара
        const avatarUrl = chat.type === 'group' 
            ? `/api/chat/group_photo/${chat.group_id}` 
            : `/api/user/photo/${chat.participant_id}`;
        
        // Добавляем атрибут group_id для групповых чатов
        const groupIdAttr = chat.type === 'group' ? `data-group-id="${chat.group_id}"` : '';
        
        // Формируем элемент чата
        chatsHTML += `
            <div class="chat-item" data-chat-id="${chat.id}" data-chat-type="${chat.type}" ${groupIdAttr}>
                <div class="chat-avatar">
                    <img src="${avatarUrl}" onerror="this.src='/static/images/avatar.png'" alt="${chat.name}">
                </div>
                <div class="chat-info">
                    <div class="chat-header">
                        <span class="chat-name">${chat.name}</span>
                        <span class="chat-time">${lastMessageTime}</span>
                    </div>
                    <div class="chat-message">${chat.last_message || 'Нет сообщений'}</div>
                </div>
            </div>
        `;
    });
    
    chatListContainer.innerHTML = chatsHTML;
    
    // Добавляем обработчики для кликов по чатам
    document.querySelectorAll('.chat-item').forEach(chatItem => {
        chatItem.addEventListener('click', function() {
            const chatId = this.dataset.chatId;
            const chatType = this.dataset.chatType;
            const chatName = this.querySelector('.chat-name').textContent;
            const groupId = chatType === 'group' ? this.dataset.groupId : null;
            
            openChat(chatId, chatType, chatName, groupId);
        });
    });
}

// Форматирование времени сообщения
function formatMessageTime(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= today) {
        // Сегодня - показываем только время
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date >= yesterday) {
        // Вчера
        return 'Вчера';
    } else {
        // Другие даты
        return date.toLocaleDateString();
    }
}

// Открытие чата для просмотра и отправки сообщений
function openChat(chatId, chatType, chatName, groupId = null) {
    // Очищаем предыдущий интервал обновления, если он был
    if (activeChatlUpdateInterval) {
        clearInterval(activeChatlUpdateInterval);
        activeChatlUpdateInterval = null;
    }
    
    // Сохраняем ID текущего чата
    currentChatId = chatId;
    currentChatType = chatType;
    currentGroupId = groupId;
    lastMessageId = null; // Сбрасываем ID последнего сообщения
    
    // Сохраняем информацию о чате в localStorage
    localStorage.setItem('lastChatId', chatId);
    localStorage.setItem('lastChatType', chatType);
    localStorage.setItem('lastChatName', chatName);
    if (groupId) localStorage.setItem('lastGroupId', groupId);
    
    // Обновляем заголовок чата
    document.querySelector('.chat-header-title').textContent = chatName;
    
    // Обновляем аватар чата с добавлением метки времени против кэширования
    const chatAvatar = document.getElementById('chat-avatar');
    if (chatAvatar) {
        const timestamp = new Date().getTime();
        const avatarUrl = chatType === 'group' 
            ? `/api/chat/group_photo/${groupId || chatId}?t=${timestamp}` 
            : `/api/user/photo/${chatId}?t=${timestamp}`;
        
        chatAvatar.src = avatarUrl;
        chatAvatar.onerror = function() {
            this.src = '/static/images/avatar.png';
        };
    }
    
    // Скрываем экран приветствия и показываем чат
    hideWelcomeScreen();
    showChat();
    
    // Загружаем сообщения
    loadChatMessages(chatId);
    
    // Добавляем атрибуты к форме отправки сообщения
    document.getElementById('message-form').dataset.chatId = chatId;
    document.getElementById('message-form').dataset.chatType = chatType;
    
    // На мобильных устройствах скрываем сайдбар
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('visible');
    }
    
    // Делаем интерфейс чата активным
    document.body.classList.add('chat-active');
    
    // Фокусируемся на поле ввода
    document.getElementById('message-input').focus();
    
    // Устанавливаем интервал только для инкрементального обновления сообщений
    activeChatlUpdateInterval = setInterval(() => {
        updateCurrentChatMessages();
    }, 1000);
    
    // Делаем полное обновление сообщений реже (каждые 30 секунд)
    // чтобы избежать мерцания от слишком частой полной перезагрузки
    setTimeout(() => {
        if (currentChatId === chatId) {
            setInterval(() => {
                if (currentChatId === chatId && !isUpdatingMessages) {
                    console.log("Выполняем периодическое полное обновление сообщений...");
                    // Используем специальный флаг для предотвращения мерцания
                    loadChatMessages(currentChatId, 0, true);
                }
            }, 30000); // Раз в 30 секунд
        }
    }, 10000); // Первое полное обновление через 10 секунд после открытия чата
    
    console.log("Настроены интервалы обновления сообщений для чата ID:", chatId);
}

// Получить текущий ID чата
function getCurrentChatId() {
    return currentChatId;
}

// Закрытие текущего чата
function closeCurrentChat() {
    // Очищаем интервал обновления сообщений
    if (activeChatlUpdateInterval) {
        clearInterval(activeChatlUpdateInterval);
        activeChatlUpdateInterval = null;
    }
    
    currentChatId = null;
    lastMessageId = null;
    document.querySelector('.messages-container').innerHTML = '<div class="no-chat-selected">Выберите чат, чтобы начать общение</div>';
    document.querySelector('.chat-header-title').textContent = 'Выберите чат';
    document.getElementById('chat-avatar').src = '/static/images/avatar.png';
    showWelcomeScreen();
    document.body.classList.remove('chat-active');
}

// Показать экран приветствия
function showWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
    }
}

// Скрыть экран приветствия
function hideWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
}

// Показать интерфейс чата
function showChat() {
    const chatInterface = document.getElementById('chat-interface');
    if (chatInterface) {
        chatInterface.style.display = 'flex';
    }
}

// Скрыть интерфейс чата
function hideChat() {
    showWelcomeScreen();
    closeCurrentChat();
}

// Показать основное содержимое (логотип и т.д.)
function showMainContent() {
    showWelcomeScreen();
}

// Скрыть основное содержимое
function hideMainContent() {
    hideWelcomeScreen();
}

// Загрузка сообщений чата
async function loadChatMessages(chatId, offset = 0, silentUpdate = false) {
    try {
        const messagesContainer = document.querySelector('.messages-container');
        
        // При первой загрузке или явном запросе на обновление показываем индикатор загрузки
        if (offset === 0 && !silentUpdate) {
            messagesContainer.innerHTML = '<div class="loading-messages">Загрузка сообщений...</div>';
        }
        
        // Добавляем временную метку для предотвращения кэширования
        const timestamp = new Date().getTime();
        
        const response = await fetch(`/api/chat/${chatId}/messages?offset=${offset}&limit=50&t=${timestamp}`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки сообщений');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Сохраняем текущую позицию прокрутки
            const scrollPos = messagesContainer.scrollTop;
            const wasAtBottom = isScrolledToBottom(messagesContainer);
            
            // Обновляем только при первой загрузке или при обычном (не тихом) обновлении
            if ((offset === 0 && !silentUpdate) || !data.messages || data.messages.length === 0) {
                messagesContainer.innerHTML = '';
            }
            
            // Проверяем, есть ли сообщения
            if (data.messages.length === 0 && offset === 0) {
                if (!silentUpdate) {
                    messagesContainer.innerHTML = '<div class="no-messages">Нет сообщений</div>';
                }
                return;
            }
            
            // Запоминаем ID последнего сообщения для последующих обновлений
            if (data.messages.length > 0) {
                // Ищем сообщение с максимальным ID
                const messageIds = data.messages.map(m => m.id).filter(id => typeof id === 'number');
                if (messageIds.length > 0) {
                    const maxId = Math.max(...messageIds);
                    // Обновляем lastMessageId только если новое значение больше текущего
                    if (!lastMessageId || maxId > lastMessageId) {
                        lastMessageId = maxId;
                        console.log(`Установлен lastMessageId: ${lastMessageId}`);
                    }
                }
            }
            
            // При тихом обновлении проверяем и обновляем только новые сообщения
            if (silentUpdate) {
                data.messages.forEach(message => {
                    // Проверяем, существует ли уже это сообщение
                    const existingMessage = document.querySelector(`.message[data-message-id="${message.id}"]`);
                    if (!existingMessage) {
                        // Создаем элемент для нового сообщения
                        const messageHTML = createMessageElement(message);
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = messageHTML;
                        
                        if (tempDiv.firstChild) {
                            // Вставляем новое сообщение в соответствующее место
                            let inserted = false;
                            
                            // Находим правильную позицию для вставки на основе timestamp
                            const messageTimestamp = new Date(message.timestamp).getTime();
                            const messages = messagesContainer.querySelectorAll('.message');
                            
                            for (let i = messages.length - 1; i >= 0; i--) {
                                const msg = messages[i];
                                const msgId = parseInt(msg.dataset.messageId);
                                
                                // Если нашли сообщение, которое должно быть перед новым
                                if (msgId < message.id) {
                                    msg.after(tempDiv.firstChild);
                                    inserted = true;
                                    break;
                                }
                            }
                            
                            // Если не нашли место, добавляем в конец
                            if (!inserted) {
                                if (messages.length > 0) {
                                    messagesContainer.appendChild(tempDiv.firstChild);
                                } else {
                                    messagesContainer.innerHTML = messageHTML;
                                }
                            }
                            
                            console.log(`Добавлено сообщение ID: ${message.id} при тихом обновлении`);
                        }
                    } else {
                        // Обновляем только статус сообщения, если оно уже есть
                        const readStatusElement = existingMessage.querySelector('.message-read-status');
                        if (readStatusElement && message.read_count) {
                            readStatusElement.textContent = '✓✓';
                            readStatusElement.classList.add('read');
                        }
                    }
                });
            } else {
                // Стандартная обработка для первой загрузки или обычного обновления
                const messagesHTML = data.messages
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .map(message => createMessageElement(message))
                    .join('');
                
                if (offset === 0) {
                    messagesContainer.innerHTML = messagesHTML;
                } else {
                    // При подгрузке добавляем сообщения в начало
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = messagesHTML;
                    while (tempDiv.firstChild) {
                        messagesContainer.prepend(tempDiv.firstChild);
                    }
                }
            }
            
            // Восстанавливаем позицию прокрутки или прокручиваем к последнему сообщению
            if (offset === 0 && !silentUpdate) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else if (silentUpdate) {
                if (wasAtBottom) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } else {
                    messagesContainer.scrollTop = scrollPos;
                }
            }
            
            // Если есть еще сообщения для загрузки, добавляем кнопку "Загрузить еще"
            if (data.has_more && offset === 0 && !silentUpdate) {
                const loadMoreBtn = document.createElement('div');
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.textContent = 'Загрузить предыдущие сообщения';
                loadMoreBtn.onclick = () => loadChatMessages(chatId, offset + data.messages.length);
                messagesContainer.prepend(loadMoreBtn);
            }
        } else {
            console.error('Ошибка при загрузке сообщений:', data.message);
            if (!silentUpdate) {
                messagesContainer.innerHTML = '<div class="error-message">Ошибка загрузки сообщений</div>';
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        if (!silentUpdate) {
            document.querySelector('.messages-container').innerHTML = 
                '<div class="error-message">Не удалось загрузить сообщения</div>';
        }
    }
    if (!messageText) {
        console.warn("Не найден элемент .message-text:", message);
        return;
    }
    
    if (!messageContent) {
        console.warn("Не найден элемент .message-content:", message);
        return;
    }
    
    // Остальной код без изменений...
    message.classList.add('has-translation-dropdown');
    
    // Create dropdown elements
    const translateDropdown = document.createElement('div');
    translateDropdown.className = 'translate-dropdown';
    translateDropdown.innerHTML = `
        <div class="translate-dropdown-icon">▼</div>
        <div class="translate-menu">
            <div class="translate-option to-russian">
                <span class="translate-icon">🔄</span>
                <span>Перевод</span>
            </div>
            <div class="translate-option to-original">
                <span class="translate-icon">↩️</span>
                <span>Оригинал</span>
            </div>
        </div>
    `;
    
    // Добавляем элементы
    messageContent.appendChild(translateDropdown);
    
    // Запоминаем оригинальный текст
    const originalText = messageText.innerHTML;
    const originalTextStore = document.createElement('div');
    originalTextStore.className = 'original-text';
    originalTextStore.innerHTML = originalText;
    messageContent.appendChild(originalTextStore);
    
    // Добавляем значок "переведено"
    const translatedBadge = document.createElement('div');
    translatedBadge.className = 'translated-badge';
    translatedBadge.textContent = 'переведено';
    messageText.after(translatedBadge);
}
    
if (typeof addTranslationDropdowns === 'function') {
    addTranslationDropdowns();
} else if (typeof initTranslationFeature === 'function') {
    initTranslationFeature();
}


// Обновление сообщений текущего чата
async function updateCurrentChatMessages() {
    if (!currentChatId || isUpdatingMessages) return;
    
    isUpdatingMessages = true;
    
    try {
        // Если у нас нет lastMessageId, делаем полную загрузку
        if (!lastMessageId) {
            await loadChatMessages(currentChatId);
            isUpdatingMessages = false;
            return;
        }
        
        // Добавляем временную метку для предотвращения кэширования
        const timestamp = new Date().getTime();
        
        // Запрашиваем только новые сообщения
        const response = await fetch(`/api/chat/${currentChatId}/messages?after_id=${lastMessageId}&t=${timestamp}`);
        
        // Обработка ответов с ошибками
        if (!response.ok) {
            if (response.status === 401) {
                // Сессия истекла, нужно перенаправить на страницу входа
                console.warn("Сессия истекла. Требуется повторная авторизация.");
                handleSessionExpired();
                isUpdatingMessages = false;
                return;
            }
            throw new Error(`Ошибка обновления сообщений: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.messages && data.messages.length > 0) {
            console.log(`Получено ${data.messages.length} новых сообщений:`, data.messages);
            const messagesContainer = document.querySelector('.messages-container');
            if (!messagesContainer) {
                console.error('Контейнер сообщений не найден');
                isUpdatingMessages = false;
                return;
            }
            
            const atBottom = isScrolledToBottom(messagesContainer);
            
            // Обновляем ID последнего сообщения из полученных новых сообщений
            const messageIds = data.messages.map(m => m.id).filter(id => typeof id === 'number');
            if (messageIds.length > 0) {
                const maxId = Math.max(...messageIds);
                if (maxId > lastMessageId) {
                    lastMessageId = maxId;
                    console.log(`Обновлен lastMessageId: ${lastMessageId}`);
                }
            }
            
            // Добавляем новые сообщения в конец
            data.messages.forEach(message => {
                if (!message.id) {
                    console.warn('Сообщение без ID:', message);
                    return;
                }
                
                // Проверяем, что сообщение еще не существует в DOM
                const existingMessage = document.querySelector(`.message[data-message-id="${message.id}"]`);
                if (!existingMessage) {
                    // Создаем элемент сообщения
                    try {
                        const messageHTML = createMessageElement(message);
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = messageHTML;
                        
                        if (tempDiv.firstChild) {
                            messagesContainer.appendChild(tempDiv.firstChild);
                            console.log(`Добавлено новое сообщение ID: ${message.id}`);
                        } else {
                            console.error(`Не удалось создать элемент для сообщения:`, message);
                        }
                    } catch (error) {
                        console.error(`Ошибка при создании элемента сообщения:`, error, message);
                    }
                } else {
                    // Обновляем статус прочтения для существующего сообщения
                    const readStatusElement = existingMessage.querySelector('.message-read-status');
                    if (readStatusElement && message.read_count) {
                        readStatusElement.textContent = '✓✓';
                        readStatusElement.classList.add('read');
                    }
                }
            });
            
            // Если пользователь был внизу чата, прокручиваем к новым сообщениям
            if (atBottom) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else if (data.messages.length > 0) {
                // Показываем индикатор новых сообщений
                showNewMessagesIndicator(data.messages.length);
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении сообщений:', error);
    } finally {
        isUpdatingMessages = false;
    }
}

// Проверка, прокручен ли контейнер сообщений до конца
function isScrolledToBottom(element) {
    const threshold = 50;
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

// Создание HTML элемента сообщения
function createMessageElement(message) {
    if (!message || !message.id) {
        console.error('Получено некорректное сообщение:', message);
        return '';
    }
    
    // Определяем, свое сообщение или нет
    const messageClass = message.is_own ? 'message-own' : 'message-other';
    
    // Форматируем время сообщения
    let messageTime;
    try {
        messageTime = formatMessageTime(new Date(message.timestamp));
    } catch (e) {
        console.error('Ошибка форматирования времени:', e);
        messageTime = 'неизвестно';
    }
    
    // Статус прочтения (только для собственных сообщений)
    const readStatus = message.is_own ? 
        `<span class="message-read-status ${message.read_count ? 'read' : ''}">
            ${message.read_count ? '✓✓' : '✓'}
        </span>` : '';
    
    // Подготовка содержимого сообщения
    let messageContent = '';
    
    // Если есть медиа
    if (message.has_media) {
        switch (message.media_type) {
            case 'image':
                messageContent += `<div class="message-media">
                    <img src="/api/chat/media/${message.id}" alt="Изображение" class="media-image">
                </div>`;
                break;
            case 'video':
                messageContent += `<div class="message-media">
                    <video controls class="media-video">
                        <source src="/api/chat/media/${message.id}" type="video/mp4">
                        Ваш браузер не поддерживает видео.
                    </video>
                </div>`;
                break;
            case 'audio':
                messageContent += `<div class="message-media">
                    <audio controls class="media-audio">
                        <source src="/api/chat/media/${message.id}" type="audio/mpeg">
                        Ваш браузер не поддерживает аудио.
                    </audio>
                </div>`;
                break;
            case 'file':
                messageContent += `<div class="message-media">
                    <a href="/api/chat/media/${message.id}" download class="media-file">
                        📎 Скачать файл
                    </a>
                </div>`;
                break;
        }
    }
    
    // Добавляем текст сообщения (если есть)
    if (message.content) {
        messageContent += `<div class="message-text">${message.content}</div>`;
    }
    
    // Создаем разметку для сообщения
    return `
        <div class="message ${messageClass}" data-message-id="${message.id}">
            <div class="message-content">
                ${messageContent}
                <div class="message-info">
                    <span class="message-time">${messageTime}</span>
                    ${readStatus}
                    ${message.is_edited ? '<span class="message-edited">(изм.)</span>' : ''}
                </div>
            </div>
        </div>
    `;
}

// Отправка сообщения
async function sendMessage() {
    if (!currentChatId) {
        alert('Выберите чат для отправки сообщения');
        return;
    }
    
    const messageInput = document.getElementById('message-input');
    const fileInput = document.getElementById('file-input');
    
    const messageText = messageInput.value.trim();
    const hasFile = fileInput.files && fileInput.files.length > 0;
    
    if (!messageText && !hasFile) {
        // Пустое сообщение без файла не отправляем
        return;
    }
    
    // Сразу очистим поле ввода после получения текста
    const messageCopy = messageText;
    messageInput.value = '';
    
    // Создаем FormData для отправки данных и файлов
    const formData = new FormData();
    formData.append('content', messageCopy);
    
    // Добавляем файл, если он выбран
    if (hasFile) {
        formData.append('media', fileInput.files[0]);
        fileInput.value = '';
        document.querySelector('.selected-file').style.display = 'none';
    }
    
    try {
        // Создаем временное сообщение в чате для немедленной обратной связи
        const tempId = `temp-${Date.now()}`;
        const messagesContainer = document.querySelector('.messages-container');
        
        // Создаем DOM элемент для временного сообщения
        const tempMessage = document.createElement('div');
        tempMessage.className = 'message message-own sending';
        tempMessage.dataset.messageId = tempId;
        tempMessage.innerHTML = `
            <div class="message-content">
                <div class="message-text">${messageCopy}</div>
                <div class="message-info">
                    <span class="message-time">Отправка...</span>
                    <span class="message-read-status">⌛</span>
                </div>
            </div>
        `;
        
        // Добавляем временное сообщение в контейнер и прокручиваем вниз
        messagesContainer.appendChild(tempMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        console.log('Отправка сообщения:', messageCopy);
        
        // Отправляем сообщение на сервер
        const response = await fetch(`/api/chat/${currentChatId}/send_message`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        console.log('Ответ сервера:', data);
        
        if (data.success) {
            // Находим временное сообщение
            const tempMsgElement = document.querySelector(`[data-message-id="${tempId}"]`);
            
            if (data.message) {
                console.log('Полученное сообщение от сервера:', data.message);
                
                if (tempMsgElement) {
                    // Обновляем существующее временное сообщение вместо удаления и создания нового
                    tempMsgElement.dataset.messageId = data.message.id;
                    tempMsgElement.classList.remove('sending');
                    
                    // Обновляем время и статус сообщения
                    const messageInfo = tempMsgElement.querySelector('.message-info');
                    if (messageInfo) {
                        const timeElement = messageInfo.querySelector('.message-time');
                        if (timeElement) {
                            timeElement.textContent = formatMessageTime(new Date(data.message.timestamp));
                        }
                        
                        const readStatusElement = messageInfo.querySelector('.message-read-status');
                        if (readStatusElement) {
                            readStatusElement.textContent = '✓';
                        }
                    }
                    
                    // Если в ответе есть какие-то медиа, обновляем контент
                    if (data.message.has_media && !tempMsgElement.querySelector('.message-media')) {
                        const messageContent = tempMsgElement.querySelector('.message-content');
                        const messageText = messageContent.querySelector('.message-text');
                        
                        // Создаем медиа элемент в зависимости от типа
                        let mediaHTML = '';
                        switch (data.message.media_type) {
                            case 'image':
                                mediaHTML = `<div class="message-media">
                                    <img src="/api/chat/media/${data.message.id}" alt="Изображение" class="media-image">
                                </div>`;
                                break;
                            case 'video':
                                mediaHTML = `<div class="message-media">
                                    <video controls class="media-video">
                                        <source src="/api/chat/media/${data.message.id}" type="video/mp4">
                                        Ваш браузер не поддерживает видео.
                                    </video>
                                </div>`;
                                break;
                            case 'audio':
                                mediaHTML = `<div class="message-media">
                                    <audio controls class="media-audio">
                                        <source src="/api/chat/media/${data.message.id}" type="audio/mpeg">
                                        Ваш браузер не поддерживает аудио.
                                    </audio>
                                </div>`;
                                break;
                            case 'file':
                                mediaHTML = `<div class="message-media">
                                    <a href="/api/chat/media/${data.message.id}" download class="media-file">
                                        📎 Скачать файл
                                    </a>
                                </div>`;
                                break;
                        }
                        
                        if (mediaHTML) {
                            // Вставляем медиа перед текстом сообщения
                            if (messageText) {
                                messageText.insertAdjacentHTML('beforebegin', mediaHTML);
                            } else {
                                messageContent.insertAdjacentHTML('afterbegin', mediaHTML);
                            }
                        }
                    }
                } else {
                    // Если по какой-то причине временное сообщение исчезло, создаем новое
                    const realMessageHTML = createMessageElement(data.message);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = realMessageHTML;
                    
                    if (tempDiv.firstChild) {
                        messagesContainer.appendChild(tempDiv.firstChild);
                    } else {
                        console.error('Не удалось создать элемент для сообщения:', data.message);
                    }
                }
                
                // Обновляем lastMessageId
                if (data.message.id > (lastMessageId || 0)) {
                    lastMessageId = data.message.id;
                    console.log(`Обновлен lastMessageId: ${lastMessageId}`);
                }
                
                // Прокрутка к последнему сообщению
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                console.warn('Сервер не вернул данные о сообщении');
                // Если сервер не вернул данные о сообщении, но сказал что успех,
                // оставим временное сообщение, но уберем статус "отправки"
                if (tempMsgElement) {
                    tempMsgElement.classList.remove('sending');
                    const readStatusElement = tempMsgElement.querySelector('.message-read-status');
                    if (readStatusElement) {
                        readStatusElement.textContent = '✓';
                    }
                    const timeElement = tempMsgElement.querySelector('.message-time');
                    if (timeElement) {
                        timeElement.textContent = formatMessageTime(new Date());
                    }
                }
            }
            
            // Запускаем обновление списка чатов через небольшую задержку
            setTimeout(() => updateChatsList(), 300);
        } else {
            console.error('Ошибка при отправке сообщения:', data.message);
            alert('Не удалось отправить сообщение: ' + data.message);
            
            // Заменяем временное сообщение на ошибку
            const tempMsgElement = document.querySelector(`[data-message-id="${tempId}"]`);
            if (tempMsgElement) {
                tempMsgElement.classList.add('error');
                tempMsgElement.querySelector('.message-time').textContent = 'Ошибка';
                tempMsgElement.querySelector('.message-read-status').textContent = '❌';
            }
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        alert('Ошибка при отправке сообщения: ' + error.message);
        
        // Возвращаем текст сообщения обратно в поле ввода при ошибке
        messageInput.value = messageCopy;
    }
}

// Показать индикатор новых сообщений
function showNewMessagesIndicator(count) {
    // Проверяем, существует ли уже индикатор
    let indicator = document.querySelector('.new-messages-indicator');
    const chatInterface = document.querySelector('.chat-interface');
    
    if (!chatInterface) return;
    
    if (!indicator) {
        // Создаем индикатор
        indicator = document.createElement('div');
        indicator.className = 'new-messages-indicator';
        indicator.textContent = `${count} новых сообщений ↓`;
        
        // Добавляем обработчик клика для прокрутки
        indicator.addEventListener('click', function() {
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                indicator.remove();
            }
        });
        
        chatInterface.appendChild(indicator);
    } else {
        // Обновляем текст индикатора
        indicator.textContent = `${count} новых сообщений ↓`;
    }
    
    // Автоматически скрываем индикатор через 5 секунд
    setTimeout(() => {
        if (indicator && indicator.parentElement) {
            indicator.remove();
        }
    }, 5000);
}

// Определение типа медиа файла
function getMediaTypeFromFile(file) {
    if (!file) return null;
    const type = file.type;
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    return 'file';
}

// Поддержание сессии активной
function keepSessionAlive() {
    fetch('/api/ping', { 
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin'
    }).catch(error => {
        console.log('Ошибка при обновлении сессии:', error);
    });
}

// Обработка истекшей сессии
function handleSessionExpired() {
    // Останавливаем все интервалы
    if (chatListUpdateInterval) clearInterval(chatListUpdateInterval);
    if (activeChatlUpdateInterval) clearInterval(activeChatlUpdateInterval);
    
    // Показываем уведомление
    const notification = document.createElement('div');
    notification.className = 'session-expired';
    notification.innerHTML = `
        <div class="session-message">
            <h3>Сессия истекла</h3>
            <p>Требуется повторная авторизация</p>
            <button id="relogin-btn">Войти снова</button>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Обработчик для кнопки
    document.getElementById('relogin-btn').addEventListener('click', () => {
        window.location.href = '/login';
    });
    
    // Автоматическое перенаправление через 5 секунд
    setTimeout(() => {
        window.location.href = '/login';
    }, 5000);
}

// Обработка выбранного файла
function handleSelectedFile() {
    const fileInput = document.getElementById('file-input');
    const selectedFileInfo = document.querySelector('.selected-file');
    
    if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = file.name;
        const fileSize = formatFileSize(file.size);
        
        // Показываем информацию о выбранном файле
        selectedFileInfo.innerHTML = `
            <div class="file-info">
                <span class="file-name">${fileName}</span>
                <span class="file-size">${fileSize}</span>
            </div>
            <button type="button" class="remove-file">✖</button>
        `;
        selectedFileInfo.style.display = 'flex';
        
        // Обработчик для кнопки удаления файла
        selectedFileInfo.querySelector('.remove-file').addEventListener('click', function() {
            fileInput.value = '';
            selectedFileInfo.style.display = 'none';
        });
    } else {
        selectedFileInfo.style.display = 'none';
    }
}

// Форматирование размера файла
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' КБ';
    else return (bytes / 1048576).toFixed(2) + ' МБ';
}

// Обновление активности пользователя
function updateUserActivity() {
    lastUserActivity = Date.now();
}

// Проверка активности пользователя
function checkUserActivity() {
    const now = Date.now();
    const inactivityThreshold = 5 * 60 * 1000; // 5 минут
    if (now - lastUserActivity > inactivityThreshold) {
        console.log('Пользователь неактивен');
        // Можно добавить логику для обработки неактивности
    } else {
        console.log('Пользователь активен');
    }
}

// Инициализация модального окна информации о группе
function initGroupInfoModal() {
    const groupInfoModal = document.getElementById('group-info-modal');
    const groupInfoCloseBtn = document.getElementById('group-info-close-btn');
    const groupInfoSaveBtn = document.getElementById('group-info-save-btn');
    const exitGroupBtn = document.getElementById('exit-group-btn');
    const deleteGroupBtn = document.getElementById('delete-group-btn');
    const addMemberBtn = document.getElementById('add-member-btn');
    const groupPhotoInput = document.getElementById('group-info-photo-input');
    const photoOverlay = document.getElementById('group-photo-change-overlay');
    
    // Закрытие модального окна
    groupInfoCloseBtn?.addEventListener('click', function() {
        groupInfoModal.classList.remove('active');
    });
    
    // Закрытие при клике вне модального окна
    groupInfoModal?.addEventListener('click', function(e) {
        if (e.target === groupInfoModal) {
            groupInfoModal.classList.remove('active');
        }
    });
    
    // Обработка загрузки новой фотографии
    photoOverlay?.addEventListener('click', function() {
        if (isCurrentUserAdmin) {
            groupPhotoInput.click();
        }
    });
    
    // Предпросмотр выбранного изображения
    groupPhotoInput?.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('group-info-preview-image').src = e.target.result;
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
    
    // Сохранение изменений в группе
    groupInfoSaveBtn?.addEventListener('click', function() {
        saveGroupChanges();
    });
    
    // Добавление новых участников
    addMemberBtn?.addEventListener('click', function() {
        openAddMembersModal();
    });
    
    // Выход из группы
    exitGroupBtn?.addEventListener('click', function() {
        if (confirm('Вы действительно хотите покинуть группу?')) {
            exitFromGroup(currentGroupId);
        }
    });
    
    // Удаление группы
    deleteGroupBtn?.addEventListener('click', function() {
        if (confirm('Вы действительно хотите удалить группу? Это действие нельзя отменить.')) {
            deleteGroup(currentGroupId);
        }
    });
    
    // Инициализация модального окна добавления участников
    initAddMembersModal();
}

// Открыть модальное окно информации о группе
async function openGroupInfoModal(groupId) {
    const groupInfoModal = document.getElementById('group-info-modal');
    const nameInput = document.getElementById('group-info-name');
    const descInput = document.getElementById('group-info-description');
    const membersCountSpan = document.getElementById('group-members-count');
    const membersList = document.getElementById('group-members-list');
    const creatorInfo = document.getElementById('group-creator-info');
    const saveBtn = document.getElementById('group-info-save-btn');
    const deleteBtn = document.getElementById('delete-group-btn');
    const photoOverlay = document.getElementById('group-photo-change-overlay');
    const addMemberBtn = document.getElementById('add-member-btn');
    
    try {
        // Показываем индикатор загрузки
        membersList.innerHTML = '<div class="loading">Загрузка данных группы...</div>';
        
        // Запрашиваем информацию о группе с сервера
        const response = await fetch(`/api/chat/group_info/${groupId}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Не удалось загрузить информацию о группе');
        }
        
        // Заполняем данными
        const groupInfo = data.group_info;
        nameInput.value = groupInfo.name;
        descInput.value = groupInfo.description || '';
        
        // Загружаем фото группы с временной меткой для предотвращения кеширования
        const timestamp = new Date().getTime();
        document.getElementById('group-info-preview-image').src = `/api/chat/group_photo/${groupId}?t=${timestamp}`;
        
        // Отображаем информацию о создателе группы
        creatorInfo.innerHTML = `
            <div class="creator-avatar">
                <img src="/api/user/photo/${groupInfo.creator_id}?t=${timestamp}" 
                     alt="${groupInfo.creator_name}" 
                     onerror="this.src='/static/images/avatar.png'">
            </div>
            <div class="creator-name">${groupInfo.creator_name}</div>
        `;
        
        // Отображаем участников
        const members = data.members;
        membersCountSpan.textContent = members.length;
        currentGroupMembers = members;
        
        let membersHTML = '';
        members.forEach(member => {
            const isAdmin = member.admin_level > 0;
            const isCreator = member.admin_level === 2;
            const isCurrentUser = member.user_id === data.current_user_id;
            
            membersHTML += `
                <div class="member-item" data-user-id="${member.user_id}">
                    <div class="member-avatar">
                        <img src="/api/user/photo/${member.user_id}?t=${timestamp}" 
                             alt="${member.nickname}" 
                             onerror="this.src='/static/images/avatar.png'">
                    </div>
                    <div class="member-info">
                        <div class="member-name">${member.nickname} ${isCurrentUser ? '(Вы)' : ''}</div>
                        <div class="member-role">${isCreator ? 'Создатель' : (isAdmin ? 'Администратор' : 'Участник')}</div>
                    </div>
                    <div class="member-actions">
                        ${!isCurrentUser && data.is_admin && !isCreator ? `
                            <button class="member-action-btn member-admin-toggle" title="${isAdmin ? 'Убрать права администратора' : 'Сделать администратором'}" 
                                    data-action="toggle-admin" data-user-id="${member.user_id}">
                                ${isAdmin ? '⭐' : '☆'}
                            </button>
                            <button class="member-action-btn" title="Удалить из группы" 
                                    data-action="remove" data-user-id="${member.user_id}">
                                ✖
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        membersList.innerHTML = membersHTML || '<div class="no-results">Нет участников</div>';
        
        // Проверяем, является ли текущий пользователь администратором
        isCurrentUserAdmin = data.is_admin;
        
        // Настраиваем интерфейс в зависимости от прав
        nameInput.readOnly = !isCurrentUserAdmin;
        descInput.readOnly = !isCurrentUserAdmin;
        saveBtn.style.display = isCurrentUserAdmin ? 'block' : 'none';
        photoOverlay.style.display = isCurrentUserAdmin ? 'flex' : 'none';
        deleteBtn.style.display = data.is_creator ? 'block' : 'none';
        addMemberBtn.style.display = isCurrentUserAdmin ? 'block' : 'none';
        
        // Добавляем обработчики для кнопок действий с участниками
        document.querySelectorAll('.member-action-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const action = this.dataset.action;
                const userId = this.dataset.userId;
                
                if (action === 'remove') {
                    if (confirm('Вы действительно хотите удалить этого участника из группы?')) {
                        removeMemberFromGroup(currentGroupId, userId);
                    }
                } else if (action === 'toggle-admin') {
                    const isAdmin = this.textContent.trim() === '⭐';
                    toggleMemberAdminStatus(currentGroupId, userId, !isAdmin);
                }
            });
        });
        
        // Показываем модальное окно
        groupInfoModal.classList.add('active');
        
    } catch (error) {
        console.error('Ошибка при загрузке данных группы:', error);
        alert('Не удалось загрузить информацию о группе: ' + error.message);
    }
}

// Сохранение изменений в группе
async function saveGroupChanges() {
    try {
        const nameInput = document.getElementById('group-info-name');
        const descInput = document.getElementById('group-info-description');
        const groupPhotoInput = document.getElementById('group-info-photo-input');
        const messageElement = document.getElementById('group-info-message');
        
        const formData = new FormData();
        formData.append('name', nameInput.value.trim());
        formData.append('description', descInput.value.trim());
        
        if (groupPhotoInput.files && groupPhotoInput.files[0]) {
            formData.append('group_photo', groupPhotoInput.files[0]);
        }
        
        const response = await fetch(`/api/chat/update_group/${currentGroupId}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Показываем сообщение об успехе
            messageElement.textContent = 'Группа успешно обновлена';
            messageElement.className = 'modal-message success';
            messageElement.style.display = 'block';
            
            // Обновляем название чата в интерфейсе
            document.querySelector('.chat-header-title').textContent = nameInput.value.trim();
            
            // Обновляем аватар чата с новой меткой времени
            const timestamp = new Date().getTime();
            const chatAvatar = document.getElementById('chat-avatar');
            if (chatAvatar) {
                chatAvatar.src = `/api/chat/group_photo/${currentGroupId}?t=${timestamp}`;
            }
            
            // Скрываем сообщение через 3 секунды
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 3000);
            
            // Обновляем список чатов
            updateChatsList();
            
        } else {
            throw new Error(data.message || 'Ошибка при обновлении группы');
        }
        
    } catch (error) {
        console.error('Ошибка при сохранении изменений группы:', error);
        const messageElement = document.getElementById('group-info-message');
        messageElement.textContent = 'Ошибка: ' + error.message;
        messageElement.className = 'modal-message error';
        messageElement.style.display = 'block';
        
        // Скрываем сообщение через 3 секунды
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 3000);
    }
}

// Выход из группы
async function exitFromGroup(groupId) {
    try {
        const response = await fetch(`/api/chat/leave_group/${groupId}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Закрываем модальное окно группы
            document.getElementById('group-info-modal').classList.remove('active');
            
            // Закрываем текущий чат
            closeCurrentChat();
            
            // Обновляем список чатов
            updateChatsList();
            
            alert('Вы успешно покинули группу');
        } else {
            throw new Error(data.message || 'Ошибка при выходе из группы');
        }
        
    } catch (error) {
        console.error('Ошибка при выходе из группы:', error);
        alert('Не удалось покинуть группу: ' + error.message);
    }
}

// Удаление группы
async function deleteGroup(groupId) {
    try {
        const response = await fetch(`/api/chat/delete_group/${groupId}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Закрываем модальное окно группы
            document.getElementById('group-info-modal').classList.remove('active');
            
            // Закрываем текущий чат
            closeCurrentChat();
            
            // Обновляем список чатов
            updateChatsList();
            
            alert('Группа успешно удалена');
        } else {
            throw new Error(data.message || 'Ошибка при удалении группы');
        }
        
    } catch (error) {
        console.error('Ошибка при удалении группы:', error);
        alert('Не удалось удалить группу: ' + error.message);
    }
}

// Удаление участника из группы
async function removeMemberFromGroup(groupId, userId) {
    try {
        const response = await fetch(`/api/chat/remove_member/${groupId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Обновляем модальное окно группы
            openGroupInfoModal(groupId);
            
        } else {
            throw new Error(data.message || 'Ошибка при удалении участника');
        }
        
    } catch (error) {
        console.error('Ошибка при удалении участника:', error);
        alert('Не удалось удалить участника: ' + error.message);
    }
}

// Изменение статуса администратора участника
async function toggleMemberAdminStatus(groupId, userId, makeAdmin) {
    try {
        const response = await fetch(`/api/chat/toggle_admin/${groupId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_id: userId,
                make_admin: makeAdmin
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Обновляем модальное окно группы
            openGroupInfoModal(groupId);
            
        } else {
            throw new Error(data.message || 'Ошибка при изменении статуса администратора');
        }
        
    } catch (error) {
        console.error('Ошибка при изменении статуса администратора:', error);
        alert('Не удалось изменить статус администратора: ' + error.message);
    }
}

// Инициализация модального окна добавления участников
function initAddMembersModal() {
    const addMembersModal = document.getElementById('add-members-modal');
    const closeBtn = document.getElementById('add-members-close-btn');
    const saveBtn = document.getElementById('add-members-save-btn');
    const searchInput = document.getElementById('add-members-search-input');
    
    // Закрытие модального окна
    closeBtn?.addEventListener('click', function() {
        addMembersModal.classList.remove('active');
    });
    
    // Закрытие при клике вне модального окна
    addMembersModal?.addEventListener('click', function(e) {
        if (e.target === addMembersModal) {
            addMembersModal.classList.remove('active');
        }
    });
    
    // Поиск пользователей
    let searchTimeout;
    searchInput?.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        searchTimeout = setTimeout(() => {
            searchContacts(query);
        }, 300);
    });
    
    // Сохранение (добавление участников)
    saveBtn?.addEventListener('click', function() {
        addSelectedMembers();
    });
}

// Открыть модальное окно добавления участников
function openAddMembersModal() {
    const addMembersModal = document.getElementById('add-members-modal');
    const selectedMembersList = document.getElementById('selected-members-list');
    const countSpan = document.getElementById('selected-add-members-count');
    
    // Сбросить выбранных участников
    selectedMembersList.innerHTML = '';
    countSpan.textContent = '0';
    window.selectedNewMembers = [];
    
    // Показать модальное окно
    addMembersModal.classList.add('active');
    
    // Загрузить контакты
    searchContacts('');
}

// Поиск контактов для добавления в группу
async function searchContacts(query) {
    const resultsContainer = document.getElementById('add-members-results');
    const loadingIndicator = document.getElementById('add-members-loading');
    
    try {
        // Показываем индикатор загрузки
        loadingIndicator.style.display = 'block';
        resultsContainer.style.display = 'none';
        
        // Запрос на сервер для поиска контактов
        const response = await fetch(`/api/chat/search_contacts?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        // Скрываем индикатор загрузки
        loadingIndicator.style.display = 'none';
        resultsContainer.style.display = 'block';
        
        if (!data.success) {
            throw new Error(data.message || 'Ошибка при поиске контактов');
        }
        
        // Отображаем результаты поиска
        if (data.contacts.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">Контакты не найдены</div>';
            return;
        }
        
        // Фильтруем контакты, исключая уже добавленных в группу
        const existingMemberIds = currentGroupMembers.map(m => m.user_id.toString());
        const filteredContacts = data.contacts.filter(contact => 
            !existingMemberIds.includes(contact.id.toString())
        );
        
        if (filteredContacts.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">Все ваши контакты уже в группе</div>';
            return;
        }
        
        // Формируем HTML
        let contactsHTML = '';
        filteredContacts.forEach(contact => {
            // Проверяем, выбран ли контакт
            const isSelected = window.selectedNewMembers && 
                              window.selectedNewMembers.some(m => m.id === contact.id);
            
            contactsHTML += `
                <div class="contact-item ${isSelected ? 'selected' : ''}" 
                     data-user-id="${contact.id}" 
                     data-nickname="${contact.nickname}">
                    <div class="contact-avatar">
                        <img src="/api/user/photo/${contact.id}" 
                             alt="${contact.nickname}" 
                             onerror="this.src='/static/images/avatar.png'">
                    </div>
                    <div class="contact-info">
                        <div class="contact-name">${contact.nickname}</div>
                    </div>
                    <div class="contact-select">
                        ${isSelected ? '✓' : ''}
                    </div>
                </div>
            `;
        });
        
        resultsContainer.innerHTML = contactsHTML;
        
        // Добавляем обработчики событий для выбора контактов
        document.querySelectorAll('#add-members-results .contact-item').forEach(item => {
            item.addEventListener('click', function() {
                const userId = this.dataset.userId;
                const nickname = this.dataset.nickname;
                toggleSelectedMember(userId, nickname, this);
            });
        });
        
    } catch (error) {
        console.error('Ошибка при поиске контактов:', error);
        loadingIndicator.style.display = 'none';
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `<div class="no-results">Ошибка: ${error.message}</div>`;
    }
}

// Выбор/отмена выбора участника для добавления
function toggleSelectedMember(userId, nickname, element) {
    if (!window.selectedNewMembers) {
        window.selectedNewMembers = [];
    }
    
    const selectedMembersList = document.getElementById('selected-members-list');
    const countSpan = document.getElementById('selected-add-members-count');
    
    // Проверяем, выбран ли уже этот пользователь
    const index = window.selectedNewMembers.findIndex(m => m.id === userId);
    
    if (index === -1) {
        // Добавляем пользователя в список выбранных
        window.selectedNewMembers.push({ id: userId, nickname: nickname });
        element.classList.add('selected');
        element.querySelector('.contact-select').textContent = '✓';
        
        // Добавляем в визуальный список
        const memberItem = document.createElement('div');
        memberItem.className = 'selected-member-item';
        memberItem.dataset.userId = userId;
        memberItem.innerHTML = `
            <span>${nickname}</span>
            <button class="remove-selected-member" data-user-id="${userId}">✕</button>
        `;
        selectedMembersList.appendChild(memberItem);
        
        // Добавляем обработчик для удаления из выбранных
        memberItem.querySelector('.remove-selected-member').addEventListener('click', function() {
            const userId = this.dataset.userId;
            const contactItem = document.querySelector(`#add-members-results .contact-item[data-user-id="${userId}"]`);
            if (contactItem) {
                contactItem.classList.remove('selected');
                contactItem.querySelector('.contact-select').textContent = '';
            }
            
            // Удаляем из массива
            const index = window.selectedNewMembers.findIndex(m => m.id === userId);
            if (index !== -1) {
                window.selectedNewMembers.splice(index, 1);
            }
            
            // Удаляем визуальный элемент
            this.parentElement.remove();
            
            // Обновляем счетчик
            countSpan.textContent = window.selectedNewMembers.length;
        });
    } else {
        // Удаляем пользователя из списка выбранных
        window.selectedNewMembers.splice(index, 1);
        element.classList.remove('selected');
        element.querySelector('.contact-select').textContent = '';
        
        // Удаляем из визуального списка
        const memberItem = selectedMembersList.querySelector(`.selected-member-item[data-user-id="${userId}"]`);
        if (memberItem) {
            memberItem.remove();
        }
    }
    
    // Обновляем счетчик
    countSpan.textContent = window.selectedNewMembers.length;
}

// Добавление выбранных участников в группу
async function addSelectedMembers() {
    if (!window.selectedNewMembers || window.selectedNewMembers.length === 0) {
        alert('Выберите участников для добавления в группу');
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/add_members/${currentGroupId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_ids: window.selectedNewMembers.map(m => m.id)
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Закрываем модальное окно добавления участников
            document.getElementById('add-members-modal').classList.remove('active');
            
            // Обновляем модальное окно группы
            openGroupInfoModal(currentGroupId);
            
        } else {
            throw new Error(data.message || 'Ошибка при добавлении участников');
        }
        
    } catch (error) {
        console.error('Ошибка при добавлении участников:', error);
        alert('Не удалось добавить участников: ' + error.message);
    }
}

// Экспорт функций для доступа из других модулей
window.chatModule = {
    initChatComponent,
    openChat,
    closeCurrentChat,
    updateChatsList,
    getCurrentChatId,
    updateCurrentChatMessages,
    updateUserActivity,
    keepSessionAlive,
    openGroupInfoModal
};


function initTranslationFeature() {
    // Add translation dropdown to all messages
    function addTranslationDropdowns() {
        document.querySelectorAll('.message:not(.has-translation-dropdown)').forEach(message => {
            const messageContent = message.querySelector('.message-content');
            const messageText = message.querySelector('.message-text');
            
            if (!messageText || !messageContent) return;
            
            message.classList.add('has-translation-dropdown');
            
            // Create dropdown elements with expanded options
            const translateDropdown = document.createElement('div');
            translateDropdown.className = 'translate-dropdown';
            translateDropdown.innerHTML = `
                <div class="translate-dropdown-icon">▼</div>
                <div class="translate-menu">
                    <div class="translate-option to-russian">
                        <span class="translate-icon">🔄</span>
                        <span>Перевод</span>
                    </div>
                    <div class="translate-option to-original">
                        <span class="translate-icon">↩️</span>
                        <span>Оригинал</span>
                    </div>
                    <div class="translate-divider"></div>
                    <div class="translate-option reply-option">
                        <span class="translate-icon">↩️</span>
                        <span>Reply</span>
                    </div>
                    <div class="translate-option edit-option">
                        <span class="translate-icon">✏️</span>
                        <span>Edit</span>
                    </div>
                    <div class="translate-option delete-option">
                        <span class="translate-icon">🗑️</span>
                        <span>Delete</span>
                    </div>
                </div>
            `;
            
            messageContent.appendChild(translateDropdown);
            
            // Store the original text
            const originalText = messageText.innerHTML;
            const originalTextStore = document.createElement('div');
            originalTextStore.className = 'original-text';
            originalTextStore.innerHTML = originalText;
            messageContent.appendChild(originalTextStore);
            
            // Add translated badge
            const translatedBadge = document.createElement('div');
            translatedBadge.className = 'translated-badge';
            translatedBadge.textContent = 'переведено';
            messageText.after(translatedBadge);
            
            // Toggle dropdown menu
            translateDropdown.addEventListener('click', function(e) {
                e.stopPropagation();
                this.classList.toggle('active');
            });
            
            // Handle translation
            translateDropdown.querySelector('.translate-option.to-russian').addEventListener('click', function(e) {
                e.stopPropagation();
                translateMessage(message, messageText);
                translateDropdown.classList.remove('active');
            });
            
            // Handle switch back to original
            translateDropdown.querySelector('.translate-option.to-original').addEventListener('click', function(e) {
                e.stopPropagation();
                restoreOriginal(message, messageText);
                translateDropdown.classList.remove('active');
            });
            
            // Handle reply action
            translateDropdown.querySelector('.reply-option').addEventListener('click', function(e) {
                e.stopPropagation();
                // Get message ID to reply to
                const messageId = message.dataset.messageId;
                replyToMessage(messageId, messageText.textContent);
                translateDropdown.classList.remove('active');
            });
            
            // Handle edit action (only for own messages)
            const editOption = translateDropdown.querySelector('.edit-option');
            if (message.classList.contains('message-own')) {
                editOption.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const messageId = message.dataset.messageId;
                    editMessage(messageId, messageText);
                    translateDropdown.classList.remove('active');
                });
            } else {
                editOption.style.display = 'none'; // Hide edit option for others' messages
            }
            
            // Handle delete action (only for own messages)
            const deleteOption = translateDropdown.querySelector('.delete-option');
            if (message.classList.contains('message-own')) {
                deleteOption.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const messageId = message.dataset.messageId;
                    deleteMessage(messageId, message);
                    translateDropdown.classList.remove('active');
                });
            } else {
                deleteOption.style.display = 'none'; // Hide delete option for others' messages
            }
        });
    }
    
    // Translate a message
    function translateMessage(messageElement, textElement) {
        // Show loading state
        const originalText = messageElement.querySelector('.original-text').innerHTML;
        textElement.innerHTML = 'Переводим...';
        
        // Call translation API (here using a mock function for demo)
        translateText(originalText)
            .then(translatedText => {
                textElement.innerHTML = translatedText;
                messageElement.classList.add('translated');
            })
            .catch(error => {
                console.error('Translation error:', error);
                textElement.innerHTML = originalText;
                alert('Ошибка перевода: ' + error.message);
            });
    }
    
    // Restore original message
    function restoreOriginal(messageElement, textElement) {
        const originalText = messageElement.querySelector('.original-text').innerHTML;
        textElement.innerHTML = originalText;
        messageElement.classList.remove('translated');
    }
    
    // Function to reply to a message
    function replyToMessage(messageId, text) {
        // Get the message input field
        const messageInput = document.getElementById('message-input');
        
        // Add reply reference to the input field
        messageInput.value = `[Reply to: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"] `;
        
        // Store the message ID being replied to (can be used when sending)
        messageInput.dataset.replyToId = messageId;
        
        // Focus on the input field
        messageInput.focus();
        
        // You might want to add visual indication of reply mode
        console.log(`Replying to message ID: ${messageId}`);
    }
    
    // Function to edit a message
    function editMessage(messageId, messageTextElement) {
        // Get the original text
        const originalText = messageTextElement.textContent;
        
        // Create an input field for editing
        const inputField = document.createElement('textarea');
        inputField.className = 'edit-message-input';
        inputField.value = originalText;
        
        // Replace message text with input field
        messageTextElement.innerHTML = '';
        messageTextElement.appendChild(inputField);
        
        // Focus and select all text
        inputField.focus();
        inputField.select();
        
        // Handle saving on Enter
        inputField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const newText = this.value.trim();
                
                // If empty, restore original text
                if (!newText) {
                    messageTextElement.innerHTML = originalText;
                    return;
                }
                
                // Send update to server
                updateMessageOnServer(messageId, newText, messageTextElement);
            }
        });
        
        // Handle canceling on Escape
        inputField.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                messageTextElement.innerHTML = originalText;
            }
        });
        
        console.log(`Editing message ID: ${messageId}`);
    }
    
    // Function to save edited message
    function updateMessageOnServer(messageId, newText, messageTextElement) {
        // Show loading state
        const originalText = messageTextElement.querySelector('.edit-message-input').value;
        messageTextElement.innerHTML = 'Сохранение...';
        
        // Make API request to update message
        fetch(`/api/chat/message/${messageId}/edit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: newText })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update the message with the new text
                messageTextElement.innerHTML = newText;
                // Maybe add an "edited" indicator if not already present
            } else {
                // Show error and restore original
                messageTextElement.innerHTML = originalText;
                alert('Failed to update message: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error updating message:', error);
            messageTextElement.innerHTML = originalText;
            alert('Error updating message');
        });
    }
    
    // Function to delete a message
    function deleteMessage(messageId, messageElement) {
        if (confirm('Are you sure you want to delete this message?')) {
            // Show loading state
            messageElement.classList.add('deleting');
            
            // Make API request to delete message
            fetch(`/api/chat/message/${messageId}/delete`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Animate removal
                    messageElement.style.height = messageElement.offsetHeight + 'px';
                    setTimeout(() => {
                        messageElement.style.height = '0';
                        messageElement.style.opacity = '0';
                        messageElement.style.margin = '0';
                        messageElement.style.padding = '0';
                        
                        // Remove element after animation
                        setTimeout(() => {
                            messageElement.remove();
                        }, 300);
                    }, 10);
                } else {
                    // Show error and remove loading state
                    messageElement.classList.remove('deleting');
                    alert('Failed to delete message: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error deleting message:', error);
                messageElement.classList.remove('deleting');
                alert('Error deleting message');
            });
        }
    }
    
    // Mock translation API function - replace with actual API call
    function translateText(text) {
        // Check if translate library is loaded
        if (typeof translate !== 'undefined') {
            // Use the translate library
            return translate(text, { to: 'ru' })
                .catch(error => {
                    console.error('Translation error:', error);
                    return `[Перевод] ${text}`;
                });
        } else {
            // Fallback if translate library is not available
            console.warn('Translation library not loaded, using fallback');
            return Promise.resolve(`[Перевод] ${text}`);
        }
    }
    
    // Add translation features to existing messages
    addTranslationDropdowns();
    
    // Create a mutation observer to watch for new messages
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length) {
                    addTranslationDropdowns();
                }
            });
        });
        
        observer.observe(messagesContainer, { childList: true, subtree: true });
    }
}

// Улучшенный обработчик для отображения выпадающего меню
function handleTranslateDropdown() {
    document.addEventListener('click', function(e) {
        // Закрываем все активные меню при клике в любом месте
        if (!e.target.closest('.translate-dropdown')) {
            document.querySelectorAll('.translate-dropdown.active').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
    
    // Делегируем обработку клика на весь документ
    document.addEventListener('click', function(e) {
        const dropdownIcon = e.target.closest('.translate-dropdown-icon');
        if (dropdownIcon) {
            e.stopPropagation();
            const dropdown = dropdownIcon.parentElement;
            
            // Сначала закрываем все открытые меню
            document.querySelectorAll('.translate-dropdown.active').forEach(activeDropdown => {
                if (activeDropdown !== dropdown) {
                    activeDropdown.classList.remove('active');
                }
            });
            
            // Переключаем активное состояние
            dropdown.classList.toggle('active');
            
            // Находим связанное меню
            const menu = dropdown.nextElementSibling;
            if (menu && menu.classList.contains('translate-menu')) {
                // Позиционируем меню относительно кнопки
                const rect = dropdown.getBoundingClientRect();
                menu.style.top = rect.bottom + 5 + 'px';  // 5px отступ
                menu.style.right = window.innerWidth - rect.right + 'px';
                
                // Обработчики для пунктов меню
                menu.querySelectorAll('.translate-option').forEach(option => {
                    option.addEventListener('click', function(e) {
                        e.stopPropagation();
                        dropdown.classList.remove('active');
                        
                        // Здесь можно добавить код для обработки выбранного действия
                        // например, перевод, удаление и т.д.
                    });
                });
            }
        }
    });
}

// Вызываем функцию инициализации при загрузке
document.addEventListener('DOMContentLoaded', function() {
    handleTranslateDropdown();
});