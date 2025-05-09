/**
 * Simple Dictionary-Based Translator
 * Provides basic translation functionality without external API dependencies
 */

// Dictionary of English to Russian translations (basic words)
const englishToRussianDictionary = {
    // Common greetings and phrases
    "hello": "привет",
    "hi": "привет",
    "hey": "эй",
    "good morning": "доброе утро",
    "good afternoon": "добрый день",
    "good evening": "добрый вечер",
    "good night": "спокойной ночи",
    "goodbye": "до свидания",
    "bye": "пока",
    "thank you": "спасибо",
    "thanks": "спасибо",
    "please": "пожалуйста",
    "sorry": "извините",
    "excuse me": "простите",
    
    // Question words
    "what": "что",
    "why": "почему",
    "where": "где",
    "when": "когда",
    "how": "как",
    "who": "кто",
    "which": "который",
    
    // Common verbs
    "is": "является",
    "are": "являются",
    "was": "был",
    "were": "были",
    "will": "будет",
    "would": "бы",
    "have": "имеют",
    "has": "имеет",
    "had": "имел",
    "do": "делать",
    "does": "делает",
    "did": "сделал",
    "can": "может",
    "could": "мог",
    "should": "должен",
    "must": "должен",
    "may": "может",
    "might": "может",
    "go": "идти",
    "come": "приходить",
    "like": "нравится",
    "want": "хотеть",
    "need": "нуждаться",
    "know": "знать",
    "think": "думать",
    "see": "видеть",
    "say": "сказать",
    "tell": "рассказать",
    
    // Common nouns
    "time": "время",
    "person": "человек",
    "year": "год",
    "day": "день",
    "thing": "вещь",
    "man": "мужчина",
    "woman": "женщина",
    "child": "ребенок",
    "world": "мир",
    "life": "жизнь",
    "hand": "рука",
    "house": "дом",
    "work": "работа",
    "book": "книга",
    "word": "слово",
    "message": "сообщение",
    "chat": "чат",
    "friend": "друг",
    
    // Common adjectives
    "good": "хороший",
    "new": "новый",
    "first": "первый",
    "last": "последний",
    "long": "длинный",
    "great": "великий",
    "little": "маленький",
    "own": "собственный",
    "other": "другой",
    "old": "старый",
    "right": "правильный",
    "big": "большой",
    "high": "высокий",
    "different": "разный",
    "small": "маленький",
    "large": "большой",
    
    // Common prepositions
    "in": "в",
    "on": "на",
    "at": "в",
    "by": "от",
    "with": "с",
    "from": "из",
    "to": "к",
    "for": "для",
    "of": "из",
    "about": "о",
    "between": "между",
    "into": "в",
    "during": "во время",
};

// Recursive function to translate all occurrences of words in a text
function translateText(text) {
    // Create a promise to mimic the behavior of an API call
    return new Promise((resolve) => {
        // Convert input to lowercase for case-insensitive matching
        const lowerText = text.toLowerCase();
        let translatedText = text;
        
        // Try to match full phrases first
        for (const [english, russian] of Object.entries(englishToRussianDictionary)) {
            // For phrases, we need exact matches with word boundaries
            if (english.includes(" ")) {
                const regex = new RegExp(`\\b${english}\\b`, 'gi');
                translatedText = translatedText.replace(regex, russian);
            }
        }
        
        // Then try to match individual words
        for (const [english, russian] of Object.entries(englishToRussianDictionary)) {
            // For single words, we need word boundaries
            if (!english.includes(" ")) {
                const regex = new RegExp(`\\b${english}\\b`, 'gi');
                translatedText = translatedText.replace(regex, russian);
            }
        }
        
        // Add translation marker when changes were made
        const hasTranslation = translatedText.toLowerCase() !== lowerText;
        
        // Simulate delay like a real API call would have
        setTimeout(() => {
            resolve(translatedText);
        }, 500);
    });
}

// Export the translation function as a global
window.translate = function(text, options) {
    // We only support translation to Russian for now
    if (options && options.to === 'ru') {
        return translateText(text);
    } else {
        // Return the original text if target language is not supported
        return Promise.resolve(text);
    }
};

console.log("Simple dictionary translator loaded!");
