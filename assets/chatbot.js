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
      <div class="gz-chatbot-heading">
        <h2 class="gz-chatbot-title">Gaming Zone Assistant</h2>
        <p class="gz-chatbot-subtitle">Ask me about our games</p>
      </div>
      <button id="gz-chatbot-close" type="button"
        aria-label="Close chatbot">×</button>
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

  const suggestedQuestions = [
    "How do I play Number Tapping?",
    "How can I improve my tapping speed?",
    "What games are available?"
  ];

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

  // Supports simple paragraphs, numbered lists, bullets, and bold text.
  // All content is inserted as text nodes, not trusted HTML.
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

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includesAny(text, phrases) {
    return phrases.some(function (phrase) {
      return text.includes(phrase);
    });
  }

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

    if (q.includes("number quest")) {
      return "number-quest.md";
    }

    if (q.includes("glow runner") || q.includes("glow-runner")) {
      return "glow-runner.md";
    }

    if (
      q.includes("neon velocity") ||
      q.includes("neon-velocity") ||
      q.includes("velocity 3d")
    ) {
      return "neon-velocity-3d.md";
    }

    if (q.includes("brick dash") || q.includes("brick-dash")) {
      return "brick-dash.md";
    }

    return null;
  }

  function answerNumberTapping(question) {
    const q = normalize(question);

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

    return [
      "Number Tapping is a number-recognition speed game.",
      "Look at the target number, find the matching number in the shuffled 3x3 grid, and tap it.",
      "The available time decreases as you progress."
    ].join("\n");
  }

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
        "games do you have"
      ])
    ) {
      return [
        "**Games in Gaming Zone:**",
        "- Number Tapping",
        "- Number Quest",
        "- Glow Runner",
        "- Neon Velocity 3D",
        "- Brick Dash",
        "",
        "Ask me how to play a particular game for more information."
      ].join("\n");
    }

    const fileName = getGameFile(question);

    if (fileName === "number-tapping.md") {
      return answerNumberTapping(question);
    }

    if (fileName) {
      return answerOtherGame(question, fileName);
    }

    // Answer general questions from the guidelines file if possible.
    if (includesAny(q, ["help", "what can you do", "who are you"])) {
      return "I'm the Gaming Zone Assistant. I can answer questions about Number Tapping and share the documented information available for Number Quest, Glow Runner, Neon Velocity 3D, and Brick Dash.";
    }

    return "I can help with Number Tapping, Number Quest, Glow Runner, Neon Velocity 3D, and Brick Dash. Please mention the game name in your question. I only provide details documented in the knowledge files.";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const question = input.value.trim();
    if (!question) return;

    addMessage("user", question);
    input.value = "";
    sendButton.disabled = true;
    input.disabled = true;

    try {
      await loadKnowledge();
      const answer = answerQuestion(question);
      addMessage("bot", answer);
    } catch (error) {
      console.error("[Gaming Zone Chatbot]", error);
      addMessage(
        "bot",
        "Sorry, something went wrong while answering. Please try again."
      );
    } finally {
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
