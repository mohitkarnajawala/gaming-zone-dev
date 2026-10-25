(function () {
  "use strict";

  // Prevent duplicate installation if the script is included twice.
  if (document.getElementById("gz-chatbot-launcher")) {
    return;
  }

  const scriptElement = document.currentScript;
  const scriptUrl = scriptElement
    ? scriptElement.src
    : window.location.href;

  // Expected structure:
  // /gaming-zone-dev/assets/chatbot.js
  // /gaming-zone-dev/assets/chatbot.css
  // /gaming-zone-dev/knowledge/number-tapping.md
  const assetsBase = new URL(".", scriptUrl);
  const knowledgeBase = new URL("../knowledge/", assetsBase);

  const knowledgeFiles = [
    "number-tapping.md",
    "number-quest.md",
    "glow-runner.md",
    "neon-velocity-3d.md",
    "brick-dash.md",
    "chatbot-guidelines.md"
  ];

  const gameKnowledge = new Map();
  let knowledgeLoaded = false;
  let knowledgeLoadPromise = null;

  // Load the stylesheet relative to this JavaScript file.
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("chatbot.css", assetsBase).href;
  document.head.appendChild(stylesheet);

  // Create the floating launcher.
  const launcher = document.createElement("button");
  launcher.id = "gz-chatbot-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open Gaming Zone chatbot");
  launcher.setAttribute("aria-expanded", "false");
  launcher.textContent = "💬";

  // Create the chatbot panel.
  const panel = document.createElement("section");
  panel.id = "gz-chatbot-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Gaming Zone chatbot");
  panel.setAttribute("aria-modal", "false");

  panel.innerHTML = `
    <header class="gz-chatbot-header">
  <div class="gz-chatbot-brand">
    <img
      id="gz-chatbot-logo"
      class="gz-chatbot-logo"
      src="./assets/images/logo.png"
      alt="Gaming Zone logo"
    />

    <div class="gz-chatbot-heading">
      <h2 class="gz-chatbot-title">Gaming Zone Assistant</h2>
      <p class="gz-chatbot-subtitle">Ask me about our games</p>
    </div>
  </div>

  <button
    id="gz-chatbot-close"
    type="button"
    aria-label="Close chatbot"
  >×</button>
</header>

    <div id="gz-chatbot-messages" aria-live="polite"></div>

    <div id="gz-chatbot-status" class="gz-chatbot-status">
      Loading game knowledge...
    </div>

    <form id="gz-chatbot-form" class="gz-chatbot-form">
      <input id="gz-chatbot-input" type="text"
        placeholder="Ask a question..."
        aria-label="Your question"
        autocomplete="off"
        maxlength="500"
        required>
      <button id="gz-chatbot-send" type="submit">Send</button>
    </form>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const closeButton = document.getElementById("gz-chatbot-close");
  const messages = document.getElementById("gz-chatbot-messages");
  const form = document.getElementById("gz-chatbot-form");
  const input = document.getElementById("gz-chatbot-input");
  const sendButton = document.getElementById("gz-chatbot-send");
  const status = document.getElementById("gz-chatbot-status");
  const logo = document.getElementById("gz-chatbot-logo");
   logo.src = new URL("images/logo.png", assetsBase).href;

  function showTypingIndicator() {
  const indicator = document.createElement("div");

  indicator.className =
    "gz-chatbot-message gz-bot gz-typing-indicator";

  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-label", "Gaming Zone Assistant is thinking");

  indicator.innerHTML = `
    <span class="gz-typing-label">Thinking</span>
    <span class="gz-typing-dots" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </span>
  `;

  messages.appendChild(indicator);
  messages.scrollTop = messages.scrollHeight;

  return indicator;
}

function waitForThinkingDelay(startTime, minimumDelay = 2300) {
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, minimumDelay - elapsed);

  return new Promise(function (resolve) {
    setTimeout(resolve, remaining);
  });
}
  const suggestedQuestions = [
    "How do I play Number Tapping?",
    "How can I improve my tapping speed?",
    "What games are available?"
  ];

  /**
   * Controls the open/closed state of the chatbot panel.
   * Updates ARIA accessibility attributes, sets focus to the input box when opened,
   * and renders the initial greeting message and question suggestion chips upon first launch.
   *
   * @param {boolean} isOpen - Whether the chatbot panel should be opened (true) or closed (false).
   */
  function setOpen(isOpen) {
    panel.classList.toggle("gz-open", isOpen);
    launcher.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      input.focus();

      if (!messages.dataset.welcomed) {
        messages.dataset.welcomed = "true";
        addMessage(
          "bot",
          "Hi! 👋 I'm the Gaming Zone Assistant. Ask me how to play a game, learn tips, or find out what information is available."
        );
        addSuggestions(suggestedQuestions);
      }
    }
  }

  launcher.addEventListener("click", function () {
    setOpen(!panel.classList.contains("gz-open"));
  });

  closeButton.addEventListener("click", function () {
    setOpen(false);
    launcher.focus();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && panel.classList.contains("gz-open")) {
      setOpen(false);
      launcher.focus();
    }
  });

  logo.addEventListener("error", function () {
  logo.style.display = "none";
});

  /**
   * Appends a new chat message bubble into the conversation history container.
   * Differentiates styling between user and bot messages, applies markdown formatting,
   * and automatically scrolls the view down to the newest message.
   *
   * @param {"user"|"bot"} type - Sender type ('user' or 'bot').
   * @param {string} text - Message text or markdown string to display.
   * @returns {HTMLDivElement} The created message DOM container element.
   */
  function addMessage(type, text) {
    const message = document.createElement("div");
    message.className = "gz-chatbot-message " +
      (type === "user" ? "gz-user" : "gz-bot");

    // Render Markdown-like formatting safely without inserting raw HTML.
    renderSimpleMarkdown(message, text);

    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
  }

  /**
   * Parses simple Markdown syntax safely into DOM elements without raw HTML injection.
   * Supports paragraphs, numbered lists (<ol>), bullet lists (<ul>), and inline bold text.
   *
   * @param {HTMLElement} container - The parent container element to receive rendered nodes.
   * @param {string} markdown - The markdown-formatted text string.
   */
  function renderSimpleMarkdown(container, markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    let currentList = null;
    let paragraphLines = [];

    function flushParagraph() {
      if (paragraphLines.length === 0) return;

      const p = document.createElement("p");
      appendInlineFormatting(p, paragraphLines.join(" "));
      container.appendChild(p);
      paragraphLines = [];
    }

    function closeList() {
      currentList = null;
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph();
        closeList();
        continue;
      }

      const numbered = line.match(/^\d+[.)]\s+(.+)$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);

      if (numbered || bullet) {
        flushParagraph();

        const tag = numbered ? "ol" : "ul";

        if (!currentList || currentList.tagName.toLowerCase() !== tag) {
          currentList = document.createElement(tag);
          container.appendChild(currentList);
        }

        const li = document.createElement("li");
        appendInlineFormatting(li, (numbered || bullet)[1]);
        currentList.appendChild(li);
        continue;
      }

      flushParagraph();
      closeList();
      paragraphLines.push(line);
    }

    flushParagraph();
  }

  /**
   * Parses inline Markdown bold tags (**bold**) within a string and appends them
   * as safe DOM <strong> elements and plain text nodes to prevent XSS vulnerabilities.
   *
   * @param {HTMLElement} parent - The DOM node to attach formatted elements to.
   * @param {string} text - The raw text line containing potential **bold** markers.
   */
  function appendInlineFormatting(parent, text) {
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g);

    for (const part of parts) {
      const boldMatch = part.match(/^\*\*(.+)\*\*$/);

      if (boldMatch) {
        const strong = document.createElement("strong");
        strong.textContent = boldMatch[1];
        parent.appendChild(strong);
      } else {
        parent.appendChild(document.createTextNode(part));
      }
    }
  }

  /**
   * Renders a row of clickable quick-suggestion buttons underneath bot responses.
   * Clicking a suggestion populates the input field and auto-submits the form.
   *
   * @param {string[]} items - Array of question strings to display as suggestion chips.
   */
  function addSuggestions(items) {
    if (!items || items.length === 0) return;

    const wrapper = document.createElement("div");
    wrapper.className = "gz-chatbot-suggestions";

    items.forEach(function (question) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gz-chatbot-suggestion";
      button.textContent = question;

      button.addEventListener("click", function () {
        input.value = question;
        form.requestSubmit();
      });

      wrapper.appendChild(button);
    });

    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  }

  /**
   * Asynchronously fetches all designated Markdown knowledge files from the knowledge folder.
   * Caches file contents in the gameKnowledge Map for rapid offline/instant lookup,
   * and updates the status indicator element in the chatbot header.
   *
   * @returns {Promise<boolean>} Resolves to true if at least one file was loaded successfully.
   */
  async function loadKnowledge() {
    if (knowledgeLoadPromise) return knowledgeLoadPromise;

    knowledgeLoadPromise = (async function () {
      const results = await Promise.allSettled(
        knowledgeFiles.map(async function (fileName) {
          const url = new URL(fileName, knowledgeBase);
          const response = await fetch(url.href, {
            cache: "no-cache"
          });

          if (!response.ok) {
            throw new Error(
              fileName + " returned HTTP " + response.status
            );
          }

          const text = await response.text();
          return { fileName: fileName, text: text };
        })
      );

      let loadedCount = 0;

      results.forEach(function (result) {
        if (result.status !== "fulfilled") {
          console.warn(
            "[Gaming Zone Chatbot] Could not load a knowledge file:",
            result.reason
          );
          return;
        }

        const item = result.value;
        gameKnowledge.set(item.fileName, item.text);
        loadedCount += 1;
      });

      knowledgeLoaded = loadedCount > 0;

      if (loadedCount === knowledgeFiles.length) {
        status.textContent = "Game knowledge loaded";
      } else if (loadedCount > 0) {
        status.textContent =
          "Some knowledge files could not be loaded";
      } else {
        status.textContent =
          "Knowledge files unavailable — check deployment paths";
      }

      return knowledgeLoaded;
    })();

    return knowledgeLoadPromise;
  }

  /**
   * Sanitizes and normalizes a string for consistent keyword and phrase matching.
   * Converts characters to lowercase, replaces punctuation and non-alphanumeric chars
   * with spaces, collapses multiple spaces, and trims whitespace.
   *
   * @param {string} text - The input text to normalize.
   * @returns {string} The cleaned, normalized string.
   */
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Checks whether the target text contains at least one of the provided search phrases.
   *
   * @param {string} text - The normalized text string to search within.
   * @param {string[]} phrases - Array of keyword or phrase substrings to check for.
   * @returns {boolean} True if any phrase matches, false otherwise.
   */
  function includesAny(text, phrases) {
    return phrases.some(function (phrase) {
      return text.includes(phrase);
    });
  }

  /**
   * Identifies which game is referenced in the user's question by matching known aliases
   * and title keywords.
   *
   * @param {string} question - The user's query string.
   * @returns {string|null} The filename of the matching knowledge Markdown file, or null if no match.
   */
  function getGameFile(question) {
    const q = normalize(question);

    if (includesAny(q, [
      "number tapping",
      "number-tapping",
      "tapping game",
      "tap the number"
    ])) {
      return "number-tapping.md";
    }

    if (includesAny(q, [
      "number quest",
      "number-quest",
      "quest game"
    ])) {
      return "number-quest.md";
    }

    if (includesAny(q, [
      "glow runner",
      "glow-runner"
    ])) {
      return "glow-runner.md";
    }

    if (includesAny(q, [
      "neon velocity",
      "neon-velocity",
      "velocity 3d",
      "infinite runner",
      "infinite-runner",
      "endless runner"
    ])) {
      return "neon-velocity-3d.md";
    }

    if (includesAny(q, [
      "brick dash",
      "brick-dash",
      "bricks dash",
      "bricks-dash",
      "brick breaker",
      "breakout"
    ])) {
      return "brick-dash.md";
    }

    return null;
  }

  /**
   * Master query routing function that evaluates user intent.
   * Handles greetings, list of available games, and delegates to the appropriate game answer
   * handler based on the matched .md knowledge filename.
   *
   * @param {string} question - The raw user prompt.
   * @returns {string} The final formatted response string.
   */
  function answerQuestion(question) {
    const q = normalize(question);

    if (!q) {
      return "Please enter a question about a Gaming Zone game.";
    }

    if (
      includesAny(q, [
        "what games",
        "available games",
        "list games",
        "which games",
        "games do you have",
        "how many total games are available"
      ])
    ) {
      return [
        "**Games in Gaming Zone are listed below:**",
        "- Number Tapping",
        "- Number Quest",
        "- Glow Runner",
        "- Neon Velocity 3D (Infinite Runner)",
        "- Brick Dash",
        "",
        "Ask me how to play a particular game for more information."
      ].join("\n");
    }

    const fileName = getGameFile(question);

    // Specific handler conditions for each game knowledge file
    if (fileName === "number-tapping.md") {
      return answerNumberTapping(question);
    }

    if (fileName === "number-quest.md") {
      return answerNumberQuest(question);
    }

    if (fileName === "glow-runner.md") {
      return answerGlowRunner(question);
    }

    if (fileName === "neon-velocity-3d.md" || fileName === "infinite-runner.md") {
      return answerInfiniteRunner(question);
    }

    if (fileName === "brick-dash.md") {
      return answerBrickDash(question);
    }

    // Fallback for any other game markdown file
    if (fileName) {
      return answerOtherGame(question, fileName);
    }

    // Answer general questions from guidelines/assistant info
    if (includesAny(q, ["help", "what can you do", "who are you"])) {
      return "I'm the Gaming Zone Assistant. I can answer questions about Number Tapping, Number Quest, Glow Runner, Neon Velocity 3D (Infinite Runner), and Brick Dash.";
    }

    return "I can help with Number Tapping, Number Quest, Glow Runner, Neon Velocity 3D (Infinite Runner), and Brick Dash. Please mention the game name in your question. I only provide details documented in the knowledge files.";
  }

  /**
   * Generates specific answers for Number Tapping questions.
   * Evaluates user queries regarding rules, tips, grid size, countdown difficulty, and objectives,
   * incorporating knowledge from 'number-tapping.md'.
   *
   * @param {string} question - The user's question.
   * @returns {string} Formatted response text.
   */
  function answerNumberTapping(question) {
    const q = normalize(question);
    const markdown = gameKnowledge.get("number-tapping.md");

    // Give a direct answer for common gameplay questions.
    if (includesAny(q, [
      "how to play",
      "how do i play",
      "how do you play",
      "explain",
      "gameplay",
      "how does it work",
      "how it works",
      "instructions",
      "rules"
    ])) {
      const section = markdown ? (extractSection(markdown, "How to Play") || extractSection(markdown, "Gameplay")) : null;
      if (section) return section;

      return [
        "**How to play Number Tapping:**",
        "1. Start the Number Tapping game.",
        "2. Look at the target number shown on the screen.",
        "3. Find the same number in the shuffled 3x3 grid.",
        "4. Tap the matching number as quickly as possible.",
        "5. Continue finding the targets as you progress.",
        "6. Be quick: the available time decreases as your progress increases."
      ].join("\n");
    }

    if (includesAny(q, [
      "tip",
      "tips",
      "strategy",
      "improve",
      "faster",
      "speed",
      "better",
      "performance"
    ])) {
      const section = markdown ? extractSection(markdown, "Tips and Strategies") : null;
      if (section) return section;

      return [
        "**Tips for Number Tapping:**",
        "- Read the target number carefully.",
        "- Scan the grid systematically.",
        "- Confirm the number before tapping.",
        "- Keep moving quickly as the timer gets shorter.",
        "- Practice to improve recognition speed."
      ].join("\n");
    }

    if (includesAny(q, [
      "grid",
      "how many cells",
      "how many boxes",
      "how many numbers"
    ])) {
      return "Number Tapping uses a shuffled grid with 3 rows and 3 columns, giving it 9 cells.";
    }

    if (includesAny(q, [
      "hard",
      "difficult",
      "timer",
      "time",
      "countdown"
    ])) {
      return "The available time decreases as your progress increases, so you need to identify and tap the target numbers more quickly.";
    }

    if (includesAny(q, [
      "objective",
      "goal",
      "purpose",
      "aim"
    ])) {
      return "Your objective is to find and tap the displayed target number in the shuffled 3x3 grid while progressing under an increasingly shorter time limit.";
    }

    const overview = markdown ? extractSection(markdown, "Overview") : null;
    if (overview) return overview;

    return [
      "Number Tapping is a number-recognition speed game.",
      "Look at the target number, find the matching number in the shuffled 3x3 grid, and tap it.",
      "The available time decreases as you progress."
    ].join("\n");
  }

  /**
   * Generates specific answers for Number Quest questions.
   * Checks the loaded 'number-quest.md' knowledge file and provides detailed
   * gameplay instructions, strategies, 3x3 grid layout, 10-second timer, and scoring rules.
   *
   * @param {string} question - The user's input query.
   * @returns {string} The formatted answer.
   */
  function answerNumberQuest(question) {
    const q = normalize(question);
    const markdown = gameKnowledge.get("number-quest.md");

    // Gameplay and instructions
    if (includesAny(q, [
      "how to play",
      "how do i play",
      "how do you play",
      "explain",
      "gameplay",
      "how does it work",
      "how it works",
      "instructions",
      "rules"
    ])) {
      const section = markdown ? (extractSection(markdown, "How to Play") || extractSection(markdown, "Gameplay")) : null;
      if (section) return section;

      return [
        "**How to play Number Quest:**",
        "1. Start the Number Quest game.",
        "2. Observe the target number indicator (starts at 1).",
        "3. Find and tap numbers on the 3x3 grid in exact sequential order: 1, 2, 3... up to 9.",
        "4. Be quick: you only have a 10-second timer for each wave.",
        "5. Tapping all numbers up to 9 completes the wave, resets the 10-second timer, and generates a new shuffled grid.",
        "6. Careful! Tapping the wrong number or letting time run out immediately ends the game."
      ].join("\n");
    }

    // Tips and strategies
    if (includesAny(q, [
      "tip",
      "tips",
      "strategy",
      "improve",
      "faster",
      "speed",
      "better",
      "high score",
      "performance"
    ])) {
      const section = markdown ? extractSection(markdown, "Tips and Strategies") : null;
      if (section) return section;

      return [
        "**Tips for Number Quest:**",
        "- Always check the next required number at the top before tapping.",
        "- Scan the 3x3 grid quickly to spot the upcoming numbers in advance.",
        "- Don't tap blindly: an incorrect tap results in an instant Game Over.",
        "- Watch the 10-second countdown bar to pace your taps.",
        "- Practice your number-scanning pattern to build huge wave streaks."
      ].join("\n");
    }

    // Grid details
    if (includesAny(q, [
      "grid",
      "how many cells",
      "how many boxes",
      "how many numbers",
      "tiles"
    ])) {
      return "Number Quest features a shuffled 3x3 grid containing 9 number tiles numbered from 1 to 9.";
    }

    // Timer & wave rules
    if (includesAny(q, [
      "timer",
      "time",
      "countdown",
      "seconds",
      "time limit",
      "wave"
    ])) {
      return "Each wave in Number Quest gives you 10 seconds. Successfully clearing all numbers from 1 to 9 resets the timer to 10 seconds for the next wave.";
    }

    // Objective
    if (includesAny(q, [
      "objective",
      "goal",
      "purpose",
      "aim"
    ])) {
      return "Your objective in Number Quest is to tap numbers in sequential order from 1 to 9 within the 10-second time limit per wave, achieving the highest score without making any mistakes.";
    }

    // Scoring & Coins
    if (includesAny(q, [
      "score",
      "points",
      "coin",
      "coins",
      "reward"
    ])) {
      return "Each correct number tap increases your score and awards 1 coin. Completing waves continuously builds your high score streak.";
    }

    // Fallback overview
    const overview = markdown ? extractSection(markdown, "Overview") : null;
    if (overview) return overview;

    return [
      "Number Quest is a sequential number-puzzle speed game.",
      "Find and tap numbers 1 through 9 in exact numerical sequence on a shuffled 3x3 grid.",
      "Each wave has a strict 10-second countdown timer. One wrong tap ends the game!"
    ].join("\n");
  }

  /**
   * Generates specific answers for Glow Runner questions.
   * Checks the loaded 'glow-runner.md' knowledge file and provides detailed
   * gameplay instructions, jumping physics, obstacle evasion, coin collection, and tips.
   *
   * @param {string} question - The user's input query.
   * @returns {string} The formatted answer.
   */
  function answerGlowRunner(question) {
    const q = normalize(question);
    const markdown = gameKnowledge.get("glow-runner.md");

    // Gameplay and instructions
    if (includesAny(q, [
      "how to play",
      "how do i play",
      "how do you play",
      "explain",
      "gameplay",
      "how does it work",
      "how it works",
      "instructions",
      "rules"
    ])) {
      const section = markdown ? (extractSection(markdown, "How to Play") || extractSection(markdown, "Gameplay")) : null;
      if (section) return section;

      return [
        "**How to play Glow Runner:**",
        "1. Start the Glow Runner game.",
        "2. Tap the screen (or click) to make your neon runner jump over ground obstacles.",
        "3. You can only jump while touching the ground (no double jumps).",
        "4. Leap over oncoming obstacles to earn score points.",
        "5. Collect floating glowing coins in mid-air or on the ground for extra rewards.",
        "6. Stay alert: obstacle speed increases progressively every 20 score points.",
        "7. Avoid collisions: hitting any obstacle results in an instant Game Over."
      ].join("\n");
    }

    // Tips and strategies
    if (includesAny(q, [
      "tip",
      "tips",
      "strategy",
      "improve",
      "faster",
      "speed",
      "better",
      "high score",
      "performance"
    ])) {
      const section = markdown ? extractSection(markdown, "Tips and Strategies") : null;
      if (section) return section;

      return [
        "**Tips for Glow Runner:**",
        "- Time your jumps carefully: jumping too early or too late will land you right on an obstacle.",
        "- Remember that jumping is only possible when you are grounded.",
        "- Prioritize dodging obstacles over grabbing risky high coins.",
        "- Anticipate the speed increase that happens every 20 points.",
        "- Keep your eyes focused slightly ahead of the runner to react faster."
      ].join("\n");
    }

    // Jump controls
    if (includesAny(q, [
      "control",
      "controls",
      "how to jump",
      "jump",
      "jumping",
      "gravity"
    ])) {
      return "Tap anywhere on the screen or click to jump. The runner is governed by smooth jump velocity and gravity, and can only jump while on the ground.";
    }

    // Obstacles & collisions
    if (includesAny(q, [
      "obstacle",
      "obstacles",
      "collide",
      "collision",
      "hit",
      "die",
      "game over"
    ])) {
      return "Obstacles spawn with randomized spacing and move towards the runner. Hitting an obstacle ends the game immediately, while successfully jumping over an obstacle awards 1 point.";
    }

    // Coins
    if (includesAny(q, [
      "coin",
      "coins",
      "collect",
      "collectibles",
      "currency"
    ])) {
      return "Glowing coins appear along the runner's path at ground level or floating in the air. Run through or jump into them to collect coins for your profile.";
    }

    // Speed & difficulty
    if (includesAny(q, [
      "speed",
      "difficulty",
      "level",
      "faster",
      "hard"
    ])) {
      return "Glow Runner features progressive difficulty: the runner and obstacle speed increases every 20 score points, putting your reflexes to the test.";
    }

    // Objective
    if (includesAny(q, [
      "objective",
      "goal",
      "purpose",
      "aim"
    ])) {
      return "Your objective is to survive as long as possible on the neon track by jumping over obstacles and collecting coins to set a new personal high score.";
    }

    // Fallback overview
    const overview = markdown ? extractSection(markdown, "Overview") : null;
    if (overview) return overview;

    return [
      "Glow Runner is a neon-styled side-scrolling endless jump-and-run game.",
      "Tap to jump over oncoming ground obstacles and collect glowing coins.",
      "Speed accelerates every 20 points, demanding sharper reflexes as you advance."
    ].join("\n");
  }

  /**
   * Generates specific answers for Neon Velocity 3D / Infinite Runner questions.
   * Checks the loaded 'neon-velocity-3d.md' knowledge file and provides detailed
   * gameplay instructions, 3-lane controls, jumping/ducking, power-ups, and strategies.
   *
   * @param {string} question - The user's input query.
   * @returns {string} The formatted answer.
   */
  function answerInfiniteRunner(question) {
    const q = normalize(question);
    const markdown = gameKnowledge.get("neon-velocity-3d.md") || gameKnowledge.get("infinite-runner.md");

    // Gameplay and instructions
    if (includesAny(q, [
      "how to play",
      "how do i play",
      "how do you play",
      "explain",
      "gameplay",
      "how does it work",
      "how it works",
      "instructions",
      "rules"
    ])) {
      const section = markdown ? (extractSection(markdown, "How to Play") || extractSection(markdown, "Gameplay")) : null;
      if (section) return section;

      return [
        "**How to play Neon Velocity 3D (Infinite Runner):**",
        "1. Start the game to enter the pseudo-3D neon highway.",
        "2. Switch between 3 lanes (Left, Center, Right) using swipe gestures or Left/Right arrow keys.",
        "3. Swipe UP (or Up arrow) to jump over low hurdles and ground barriers.",
        "4. Swipe DOWN (or Down arrow) to duck and slide under overhead laser barriers.",
        "5. Swipe DOWN while mid-air to fast-fall back to the road quickly.",
        "6. Collect Neon Coins, Energy Orbs, and power-ups (Shield, Magnet, 2x Multiplier).",
        "7. Avoid unshielded collisions with barriers to keep your run alive and maximize distance."
      ].join("\n");
    }

    // Tips and strategies
    if (includesAny(q, [
      "tip",
      "tips",
      "strategy",
      "improve",
      "faster",
      "speed",
      "better",
      "high score",
      "performance"
    ])) {
      const section = markdown ? extractSection(markdown, "Tips and Strategies") : null;
      if (section) return section;

      return [
        "**Tips for Neon Velocity 3D (Infinite Runner):**",
        "- Default to the center lane: it gives you the fastest escape route to either the left or right lane.",
        "- Use the mid-air fast-fall (Swipe Down) to land immediately if you see an overhead barrier right after a jump.",
        "- Always grab the Shield power-up: it saves you from one fatal collision.",
        "- With the Magnet active, focus 100% on dodging obstacles since coins from all lanes will fly to you automatically.",
        "- Watch the curving road ahead to spot oncoming barrier lanes well in advance."
      ].join("\n");
    }

    // Controls
    if (includesAny(q, [
      "control",
      "controls",
      "swipe",
      "keys",
      "how to move",
      "how to jump",
      "how to duck",
      "slide"
    ])) {
      return [
        "**Controls for Neon Velocity 3D (Infinite Runner):**",
        "- **Swipe Left / Left Arrow**: Move to the left lane.",
        "- **Swipe Right / Right Arrow**: Move to the right lane.",
        "- **Swipe Up / Up Arrow**: Jump over low hurdles.",
        "- **Swipe Down / Down Arrow**: Duck/slide under high lasers (or fast-fall while mid-air)."
      ].join("\n");
    }

    // Power-ups
    if (includesAny(q, [
      "power up",
      "powerup",
      "powerups",
      "power ups",
      "shield",
      "magnet",
      "multiplier",
      "coin",
      "coins",
      "orb",
      "orbs"
    ])) {
      return [
        "**Power-ups & Collectibles in Neon Velocity 3D:**",
        "- **Shield**: Absorbs 1 obstacle collision without ending your game.",
        "- **Magnet**: Automatically draws nearby coins from all lanes to your runner.",
        "- **Score Multiplier (2x)**: Doubles all score points earned while active.",
        "- **Neon Coins**: Grants currency and score bonus.",
        "- **Energy Orbs**: Awards a large instant score boost."
      ].join("\n");
    }

    // Lanes & Highway
    if (includesAny(q, [
      "lane",
      "lanes",
      "track",
      "road",
      "curve"
    ])) {
      return "The game features a dynamic 3-lane neon highway (Left, Center, Right) with smooth 3D banking, curving tracks, and progressive speed acceleration.";
    }

    // Objective
    if (includesAny(q, [
      "objective",
      "goal",
      "purpose",
      "aim"
    ])) {
      return "Your objective is to sprint as far as possible down the 3D neon highway, evading hurdles and laser barriers while gathering coins and power-ups for the highest score.";
    }

    // Fallback overview
    const overview = markdown ? extractSection(markdown, "Overview") : null;
    if (overview) return overview;

    return [
      "Neon Velocity 3D (Infinite Runner) is an adrenaline-fueled pseudo-3D endless runner.",
      "Switch lanes, jump low barriers, slide under high lasers, and collect power-ups like shields and magnets.",
      "Track curves and speed increases over distance to test your reflexes."
    ].join("\n");
  }

  // Alias for compatibility
  const answerNeonVelocity3D = answerInfiniteRunner;

  /**
   * Generates specific answers for Brick Dash questions.
   * Checks the loaded 'brick-dash.md' knowledge file and provides detailed
   * gameplay instructions, paddle controls, combo multipliers, brick colors, and strategies.
   *
   * @param {string} question - The user's input query.
   * @returns {string} The formatted answer.
   */
  function answerBrickDash(question) {
    const q = normalize(question);
    const markdown = gameKnowledge.get("brick-dash.md");

    // Gameplay and instructions
    if (includesAny(q, [
      "how to play",
      "how do i play",
      "how do you play",
      "explain",
      "gameplay",
      "how does it work",
      "how it works",
      "instructions",
      "rules"
    ])) {
      const section = markdown ? (extractSection(markdown, "How to Play") || extractSection(markdown, "Gameplay")) : null;
      if (section) return section;

      return [
        "**How to play Brick Dash:**",
        "1. Start the Brick Dash game.",
        "2. Control the neon paddle at the bottom by dragging your finger/mouse or using arrow keys.",
        "3. Deflect the bouncing glowing ball upwards into the rows of colorful neon bricks.",
        "4. Smash bricks to earn points and coins.",
        "5. Keep the ball bouncing: consecutive brick hits increase your combo multiplier.",
        "6. Do not let the ball drop below the paddle, or it will be Game Over.",
        "7. Destroy all the bricks on the screen to achieve total stage victory!"
      ].join("\n");
    }

    // Tips and strategies
    if (includesAny(q, [
      "tip",
      "tips",
      "strategy",
      "improve",
      "faster",
      "speed",
      "better",
      "high score",
      "performance"
    ])) {
      const section = markdown ? extractSection(markdown, "Tips and Strategies") : null;
      if (section) return section;

      return [
        "**Tips for Brick Dash:**",
        "- Use the edges of your paddle: hitting the ball with the outer ends reflects it at sharper angles.",
        "- Aim for the upper corners to send the ball behind the brick wall for multiple automatic bounces.",
        "- Maintain ball momentum to build and keep high combo score multipliers.",
        "- Keep track of the ball's trajectory rather than watching your paddle.",
        "- Stay ready for higher ball speeds as the stage progresses."
      ].join("\n");
    }

    // Paddle controls
    if (includesAny(q, [
      "control",
      "controls",
      "paddle",
      "how to move",
      "keys",
      "drag"
    ])) {
      return "Move the paddle left and right across the bottom using touch drag, mouse movement, or Left/Right keyboard arrow keys to intercept and deflect the ball.";
    }

    // Combo multiplier & scoring
    if (includesAny(q, [
      "combo",
      "multiplier",
      "score",
      "points",
      "coin",
      "coins"
    ])) {
      return "Consecutive brick hits without losing the ball build up your combo multiplier, exponentially increasing points earned. You also gain coins for every destroyed brick.";
    }

    // Bricks & colors
    if (includesAny(q, [
      "brick",
      "bricks",
      "color",
      "colors",
      "layout",
      "rows"
    ])) {
      return "Brick Dash features vibrant multi-colored neon bricks (Pink, Orange, Amber, Cyan, Electric Blue, Violet, Emerald Green, and Magenta). Smashing every brick completes the level!";
    }

    // Objective
    if (includesAny(q, [
      "objective",
      "goal",
      "purpose",
      "aim",
      "win"
    ])) {
      return "Your objective is to clear all colorful neon bricks by skillfully deflecting the bouncing ball with your paddle without letting the ball fall past the bottom.";
    }

    // Fallback overview
    const overview = markdown ? extractSection(markdown, "Overview") : null;
    if (overview) return overview;

    return [
      "Brick Dash is an arcade neon brick-breaker built on the Flame game engine.",
      "Control the bottom paddle to deflect the glowing ball, shatter colorful brick formations, and rack up combo multipliers.",
      "Clear all bricks to complete the game!"
    ].join("\n");
  }

  /**
   * Scans a Markdown string and extracts the text content under a designated heading.
   * Matches ATX headings (# through ######) case-insensitively and returns all lines
   * until the next heading of any level is encountered.
   *
   * @param {string} markdown - The raw markdown text to search.
   * @param {string} heading - The target heading title to look for.
   * @returns {string} The extracted section content, or an empty string if not found.
   */
  function extractSection(markdown, heading) {
    const lines = String(markdown || "").split(/\r?\n/);
    const wanted = normalize(heading);
    let collecting = false;
    const collected = [];

    for (const line of lines) {
      const match = line.match(/^#{1,6}\s+(.+)$/);

      if (match) {
        const currentHeading = normalize(match[1]);

        if (collecting) break;

        if (currentHeading === wanted) {
          collecting = true;
          continue;
        }
      }

      if (collecting) {
        collected.push(line);
      }
    }

    return collected.join("\n").trim();
  }

  /**
   * Generic fallback answer generator for any game .md file that doesn't have a dedicated handler.
   * Dynamically inspects the Markdown file for standard headings like 'How to Play',
   * 'Common Questions', 'Tips and Strategies', or 'Overview'.
   *
   * @param {string} question - The user's query.
   * @param {string} fileName - The knowledge markdown filename to query.
   * @returns {string} Extracted section content or a helpful fallback message.
   */
  function answerOtherGame(question, fileName) {
    const markdown = gameKnowledge.get(fileName);

    if (!markdown) {
      return "I couldn't load the knowledge file for this game. Please check that the Markdown file is deployed under the website's knowledge folder.";
    }

    const q = normalize(question);

    if (includesAny(q, [
      "how to play",
      "how do i play",
      "how do you play",
      "gameplay",
      "instructions",
      "rules",
      "controls"
    ])) {
      const section =
        extractSection(markdown, "How to Play") ||
        extractSection(markdown, "Common Questions");

      if (section) {
        return section;
      }
    }

    if (includesAny(q, [
      "tip",
      "tips",
      "strategy",
      "improve",
      "better",
      "score"
    ])) {
      const section = extractSection(markdown, "Tips and Strategies");

      if (section) {
        return section;
      }
    }

    const overview = extractSection(markdown, "Overview");

    if (overview) {
      return overview +
        "\n\nFor exact controls and gameplay steps, please check the instructions shown inside the game.";
    }

    return "I don't have confirmed information about that game yet. Please check its in-game instructions.";
  }

  // Handle form submission and chatbot response generation
 form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const question = input.value.trim();

  if (!question) return;

  // Display the user's message immediately.
  addMessage("user", question);
  input.value = "";

  // Prevent multiple submissions while the assistant is responding.
  sendButton.disabled = true;
  input.disabled = true;

  // Show the animated thinking indicator.
  const thinkingStartedAt = Date.now();
  const typingIndicator = showTypingIndicator();

  try {
    // Load knowledge and prepare the answer while the indicator is visible.
    await loadKnowledge();

    const answer = answerQuestion(question);

    // Keep the indicator visible for at least 2.3 seconds.
    await waitForThinkingDelay(thinkingStartedAt, 2300);

    // Remove the indicator before displaying the answer.
    typingIndicator.remove();

    addMessage("bot", answer);
  } catch (error) {
    console.error("[Gaming Zone Chatbot]", error);

    await waitForThinkingDelay(thinkingStartedAt, 2300);

    typingIndicator.remove();

    addMessage(
      "bot",
      "Sorry, something went wrong while answering. Please try again."
    );
  } finally {
    // Clean up the indicator if an unexpected error occurred.
    if (typingIndicator.isConnected) {
      typingIndicator.remove();
    }

    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
});

  // Load the files at startup so deployment problems appear in the status.
  loadKnowledge().catch(function (error) {
    console.error("[Gaming Zone Chatbot] Knowledge loading failed:", error);
  });
})();
