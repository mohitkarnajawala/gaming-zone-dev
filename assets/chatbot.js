
(() => {
  const scriptUrl = document.currentScript.src;
  const knowledgeUrl = new URL("../knowledge/", scriptUrl);

  const gameFiles = [
    "number-tapping.md",
    "number-quest.md",
    "glow-runner.md",
    "neon-velocity-3d.md",
    "brick-dash.md"
  ];

  const stopWords = new Set([
    "how", "what", "where", "when", "why", "can", "could",
    "do", "does", "the", "a", "an", "is", "are", "i",
    "me", "my", "to", "for", "of", "in", "on", "it",
    "this", "that", "you", "your", "please", "tell", "about"
  ]);

  let knowledge = [];
  let loading = null;

  const root = document.createElement("div");
  root.id = "gz-chatbot";

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("./chatbot.css", scriptUrl).href;
  document.head.appendChild(css);

  root.innerHTML = `
    <section class="gz-window" role="dialog"
      aria-label="Gaming Zone assistant" aria-hidden="true">
      <header class="gz-header">
        <div>
          <div class="gz-title">🎮 Gaming Zone AI</div>
          <div class="gz-subtitle">Your game guide</div>
        </div>
        <button class="gz-close" aria-label="Close chat">×</button>
      </header>

      <div class="gz-messages" aria-live="polite"></div>

      <form class="gz-form">
        <input class="gz-input" aria-label="Ask a question"
          placeholder="Ask about a game..." autocomplete="off" />
        <button class="gz-send" type="submit">Send</button>
      </form>

      <div class="gz-footer">
        Answers are retrieved from Gaming Zone game guides.
      </div>
    </section>

    <button class="gz-launcher" aria-label="Open Gaming Zone chat"
      aria-expanded="false">💬</button>
  `;

  document.body.appendChild(root);

  const panel = root.querySelector(".gz-window");
  const launcher = root.querySelector(".gz-launcher");
  const close = root.querySelector(".gz-close");
  const messages = root.querySelector(".gz-messages");
  const form = root.querySelector(".gz-form");
  const input = root.querySelector(".gz-input");
  const send = root.querySelector(".gz-send");

  function toggleChat(open) {
    panel.classList.toggle("gz-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    launcher.setAttribute("aria-expanded", String(open));

    if (open) input.focus();
  }

  launcher.addEventListener("click", () => toggleChat(true));
  close.addEventListener("click", () => toggleChat(false));

  function addMessage(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = `gz-message ${sender === "user"
      ? "gz-user" : "gz-bot"}`;

    // textContent prevents retrieved Markdown from injecting HTML.
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function cleanMarkdown(text) {
    return text
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*]\s+/gm, "• ")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .trim();
  }

  function tokenize(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word));
  }

  function parseSections(markdown, filename) {
    const lines = markdown.split(/\r?\n/);
    const title = filename.replace(/\.md$/i, "")
      .replace(/-/g, " ");

    const sections = [];
    let heading = title;
    let body = [];

    function save() {
      const content = body.join("\n").trim();
      if (content) {
        sections.push({
          title: heading,
          content,
          source: title
        });
      }
    }

    for (const line of lines) {
      if (/^#{1,3}\s+/.test(line)) {
        save();
        heading = line.replace(/^#{1,3}\s+/, "").trim();
        body = [];
      } else {
        body.push(line);
      }
    }

    save();

    return {
      title,
      sections,
      text: markdown
    };
  }

  async function loadKnowledge() {
    if (loading) return loading;

    loading = Promise.all(
      gameFiles.map(async filename => {
        const response = await fetch(
          new URL(filename, knowledgeUrl)
        );

        if (!response.ok) {
          throw new Error(`Could not load ${filename}`);
        }

        const markdown = await response.text();
        return parseSections(markdown, filename);
      })
    ).then(games => {
      knowledge = games;
      return games;
    });

    return loading;
  }

  function scoreText(queryTokens, text) {
    const words = new Set(tokenize(text));
    let score = 0;

    for (const token of queryTokens) {
      if (words.has(token)) score += 1;
    }

    return score;
  }

  function answerQuestion(question) {
    const queryTokens = tokenize(question);

    if (queryTokens.length === 0) {
      return "Ask me about a Gaming Zone game, its controls, rules, or tips.";
    }

    const rankedGames = knowledge.map(game => ({
      ...game,
      score: scoreText(queryTokens, game.title + " " + game.text)
    })).sort((a, b) => b.score - a.score);

    const bestGame = rankedGames[0];

    if (!bestGame || bestGame.score === 0) {
      return "I couldn't find that in the game guides yet. Try mentioning the game name, such as Number Tapping or Glow Runner.";
    }

    const rankedSections = bestGame.sections.map(section => ({
      ...section,
      score: scoreText(
        queryTokens,
        section.title + " " + section.content
      )
    })).sort((a, b) => b.score - a.score);

    const relevant = rankedSections
      .filter(section => section.score > 0)
      .slice(0, 2);

    if (relevant.length === 0) {
      return `I found the ${bestGame.title} guide, but couldn't find a specific answer. Try asking about how to play, controls, or tips.`;
    }

    const answer = relevant.map(section => {
      return `${section.title}\n${cleanMarkdown(section.content)}`;
    }).join("\n\n");

    return `${bestGame.title}\n\n${answer}\n\nSource: ${bestGame.title} game guide`;
  }

  addMessage(
    "Hi! 👋 Ask me how to play a game, understand its rules, or improve your score.",
    "bot"
  );

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const question = input.value.trim();
    if (!question) return;

    addMessage(question, "user");
    input.value = "";
    send.disabled = true;

    try {
      await loadKnowledge();
      addMessage(answerQuestion(question), "bot");
    } catch (error) {
      console.error("Gaming Zone chatbot:", error);
      addMessage(
        "I couldn't load the game guides. Please try again later.",
        "bot"
      );
    } finally {
      send.disabled = false;
      input.focus();
    }
  });
})();
