const AI_CONFIG = {
  model: "deepseek/deepseek-coder",
  temperature: 0.3,
  maxTokens: 1000
};

function extractExpectedResult(description) {
  const match = description.match(/```\n([\s\S]*?)```/);
  return match ? match[1].trim() : "Не указан";
}

function setApiKey(key) {
  localStorage.setItem("openrouter_api_key", key);
}

function getApiKey() {
  return localStorage.getItem("openrouter_api_key") || "rk.x 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";
}

function hasApiKey() {
  const key = getApiKey();
  return key && key.trim().length > 0;
}

async function checkCodeWithAI(task, userCode) {
  const expectedResult = extractExpectedResult(task.description);

  const prompt = `Ты - Python тьютор. Проверь решение студента.

## Задача
${task.title}
${task.description.replace(/```[\s\S]*?```/g, "")}

## Ожидаемый результат
${expectedResult}

## Код студента
${userCode}

## Важные правила проверки:
1. ЗАПРЕЩЕНО считать верным код, который просто выводит ожидаемый результат текстом
   - "print('42')" для задачи "15+27" - НЕВЕРНО (это подсказка, а не решение)
   - Код должен ВЫЧИСЛЯТЬ результат, а не просто выводить его
2. Проверь что используются правильные операторы/функции/логика
3. Выполни код мысленно и сверь результат

## Формат ответа (строго JSON):
{
  "correct": true/false,
  "feedback": "комментарий",
  "errors": ["ошибки если есть"],
  "hints": ["подсказки если есть"]
}

Отвечай ТОЛЬКО JSON.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Python Tutor"
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages: [
        {
          role: "system",
          content: "Ты - Python тьютор. Проверяй код и отвечай валидным JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Ошибка API: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return {
    correct: false,
    feedback: "Не удалось обработать ответ",
    errors: ["Некорректный формат ответа"],
    hints: []
  };
}

function createFallbackCheck(task, userCode) {
  const title = task.title.toLowerCase();

  if (title.includes("hello")) {
    const hasPrintHello = userCode.includes('print') && /hello/i.test(userCode);
    const isHardcoded = /print\s*\(\s*['"]hello/i.test(userCode);
    if (hasPrintHello && !isHardcoded) {
      return { correct: true, feedback: "Верно! Код выводит Hello, World!" };
    }
    return { correct: false, feedback: "Нужен вывод 'Hello, World!' через print()", errors: [], hints: ["print('Hello, World!')"] };
  }

  if (title.includes("сложение")) {
    const hasCalculation = /15\s*\+\s*27/.test(userCode);
    const isHardcoded = /print\s*\(\s*['"]42/i.test(userCode);
    if (hasCalculation && !isHardcoded) {
      return { correct: true, feedback: "Верно! 15 + 27 = 42" };
    }
    return { correct: false, feedback: "Вычислите 15 + 27, а не просто выводите 42", errors: [], hints: ["print(15 + 27)"] };
  }

  if (title.includes("переменн")) {
    const hasVariable = /name\s*=/i.test(userCode);
    const hasAlice = /["']алиса/i.test(userCode);
    const isHardcoded = /print\s*\(\s*['"]алиса/i.test(userCode);
    if (hasVariable && hasAlice && !isHardcoded) {
      return { correct: true, feedback: "Верно! Переменная создана" };
    }
    return { correct: false, feedback: "Создайте переменную name = 'Алиса' и выведите её", errors: [], hints: ["name = 'Алиса'; print(name)"] };
  }

  if (title.includes("цикл") || title.includes("for")) {
    const hasRange = /range\s*\(\s*1\s*,\s*6\s*\)/.test(userCode);
    const hasFor = /for/i.test(userCode);
    if (hasRange && hasFor) {
      return { correct: true, feedback: "Верно! Цикл выводит 1-5" };
    }
    return { correct: false, feedback: "Используйте for i in range(1,6)", errors: [], hints: [] };
  }

  if (title.includes("список") && title.includes("перв")) {
    const hasIndex = /\[\s*0\s*\]/.test(userCode);
    if (hasIndex) {
      return { correct: true, feedback: "Верно!" };
    }
    return { correct: false, feedback: "Используйте fruits[0]", errors: [], hints: [] };
  }

  if (title.includes("функц")) {
    const hasDef = /def\s+greet/.test(userCode);
    const hasReturn = /return/i.test(userCode);
    if (hasDef && hasReturn) {
      return { correct: true, feedback: "Верно!" };
    }
    return { correct: false, feedback: "Создайте функцию def greet(name):", errors: [], hints: [] };
  }

  if (title.includes("срез")) {
    const hasSlice = /\[\s*2\s*:\s*5\s*\]/.test(userCode);
    if (hasSlice) {
      return { correct: true, feedback: "Верно!" };
    }
    return { correct: false, feedback: "Используйте numbers[2:5]", errors: [], hints: [] };
  }

  if (title.includes("условие") || title.includes("if")) {
    const hasIf = /if\s+.*>\s*10/.test(userCode);
    if (hasIf) {
      return { correct: true, feedback: "Верно!" };
    }
    return { correct: false, feedback: "Используйте if x > 10", errors: [], hints: [] };
  }

  return null;
}

async function verifyCode(task, userCode) {
  try {
    if (hasApiKey()) {
      return await checkCodeWithAI(task, userCode);
    }
  } catch (e) {
    console.log("AI недоступен:", e.message);
  }

  const fallback = createFallbackCheck(task, userCode);
  return fallback || {
    correct: false,
    feedback: "Нужен API ключ для проверки",
    errors: [],
    hints: []
  };
}